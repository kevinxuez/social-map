#!/usr/bin/env sh
set -euo pipefail

echo "[start] Boot script running..."
: "${UVICORN_HOST:=0.0.0.0}"
: "${UVICORN_PORT:=8000}"
: "${UVICORN_WORKERS:=2}"
: "${UVICORN_LOG_LEVEL:=info}"

DB_URL="${DATABASE_URL:-}"
REDIS_URL="${REDIS_URL:-}"

retry() {
  attempts=$1; shift
  delay=$1; shift
  n=1
  while true; do
    "$@" && break || {
      if [ $n -ge $attempts ]; then
        echo "[start][error] Command failed after $n attempts: $*" >&2
        return 1
      fi
      echo "[start][warn] Attempt $n failed: $*. Retrying in ${delay}s..."
      n=$((n+1))
      sleep "$delay"
    }
  done
}

wait_for_postgres() {
  [ -z "$DB_URL" ] && { echo "[start][warn] DATABASE_URL not set, skipping PG wait"; return 0; }
  python - <<'PY'
import os,sys,time
import psycopg2
from urllib.parse import urlparse
url=os.environ['DATABASE_URL']
parsed=urlparse(url.replace('+psycopg',''))
for i in range(30):
  try:
    conn=psycopg2.connect(dbname=parsed.path[1:], user=parsed.username, password=parsed.password, host=parsed.hostname, port=parsed.port or 5432)
    conn.close()
    print('[start] Postgres reachable')
    sys.exit(0)
  except Exception as e:
    print('[start][wait] Postgres not ready:',e)
    time.sleep(2)
print('[start][error] Postgres not reachable after retries', file=sys.stderr)
sys.exit(1)
PY
}

wait_for_redis() {
  [ -z "$REDIS_URL" ] && { echo "[start][warn] REDIS_URL not set, skipping Redis wait"; return 0; }
  python - <<'PY'
import os,sys,time
import redis.asyncio as r
url=os.environ['REDIS_URL']
async def main():
  for i in range(30):
    try:
      client=r.from_url(url)
      pong=await client.ping()
      if pong:
        print('[start] Redis reachable')
        await client.aclose(); return
    except Exception as e:
      print('[start][wait] Redis not ready:',e)
    await asyncio.sleep(2)
  print('[start][error] Redis not reachable after retries', file=sys.stderr)
  sys.exit(1)
import asyncio; asyncio.run(main())
PY
}

wait_for_postgres
wait_for_redis

# Run migrations with retry (handles race with other containers)
retry 5 3 alembic upgrade head

# Launch app
exec uvicorn app.main:app --host "$UVICORN_HOST" --port "$UVICORN_PORT" --workers "$UVICORN_WORKERS" --log-level "$UVICORN_LOG_LEVEL" --proxy-headers
