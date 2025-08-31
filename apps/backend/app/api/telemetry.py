from fastapi import APIRouter, Request
import logging
import time

router = APIRouter(prefix="/telemetry")
logger = logging.getLogger("telemetry")

@router.post("/")
async def ingest(event: dict, request: Request):
    # best-effort: log and return 202
    event_type = event.get('type')
    ts = event.get('ts') or time.time()
    user = event.get('user')
    logger.info(f"telemetry type={event_type} user={user} ts={ts}")
    return {"accepted": True}
