from fastapi import Request, HTTPException
from .redis import get_redis

RATE_LIMIT = 120
WINDOW_SECONDS = 60

async def rate_limit(request: Request):
    redis = await get_redis()
    ip = request.client.host if request.client else 'unknown'
    key = f"rl:{ip}"
    cnt = await redis.incr(key)
    if cnt == 1:
        await redis.expire(key, WINDOW_SECONDS)
    if cnt > RATE_LIMIT:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")
