import os
from fastapi import FastAPI, Request
import time
import logging
from fastapi.middleware.cors import CORSMiddleware
from app.api.entities import router as entities_router
from app.api.groups import router as groups_router
from app.api.edges import router as edges_router
from app.api.graph import router as graph_router
from app.api.csv_io import router as csv_router
from app.api.telemetry import router as telemetry_router
from app.core.rate_limit import rate_limit

app = FastAPI()
origins = os.getenv('CORS_ORIGINS','').split(',') if os.getenv('CORS_ORIGINS') else ['http://localhost:3000']
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=['*'], allow_headers=['*'])
app.include_router(entities_router)
app.include_router(groups_router)
app.include_router(edges_router)
app.include_router(graph_router)
app.include_router(csv_router)
app.include_router(telemetry_router)

logger = logging.getLogger("uvicorn.access")

@app.get('/healthz')
async def healthz():
	return {'status':'ok'}

@app.middleware("http")
async def _middleware_chain(request: Request, call_next):
	start = time.time()
	# rate limit (skip if disabled)
	if os.getenv('DISABLE_RATE_LIMIT') != '1' and not request.url.path.startswith(('/docs','/openapi')):
		try:
			await rate_limit(request)
		except Exception as e:  # propagate HTTPException
			from fastapi.responses import JSONResponse
			if hasattr(e, 'status_code'):
				duration = (time.time()-start)*1000
				logger.info(f"{request.method} {request.url.path} -> {getattr(e,'status_code',0)} {duration:.1f}ms")
				return JSONResponse(status_code=e.status_code, content={'detail': getattr(e, 'detail', 'error')})
			raise
	response = await call_next(request)
	duration = (time.time()-start)*1000
	logger.info(f"{request.method} {request.url.path} -> {response.status_code} {duration:.1f}ms")
	return response
