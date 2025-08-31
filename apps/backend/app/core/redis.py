import os
import redis.asyncio as redis

_redis_client = None

async def get_redis():
    global _redis_client
    if _redis_client is None:
        url = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
        _redis_client = redis.from_url(url, encoding='utf-8', decode_responses=True)
    return _redis_client

async def close_redis():
    global _redis_client
    if _redis_client:
        await _redis_client.aclose()
        _redis_client = None
