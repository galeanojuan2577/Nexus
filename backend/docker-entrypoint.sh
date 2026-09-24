#!/bin/sh
set -e

echo "Running database migrations..."
python - <<'PY'
import asyncio
import time

async def main():
    from nexus.core.database import init_db
    last = None
    for attempt in range(1, 31):
        try:
            await init_db()
            print(f"Database ready (attempt {attempt}).")
            return
        except Exception as exc:  # noqa: BLE001
            last = exc
            print(f"DB not ready ({attempt}/30): {exc}", flush=True)
            await asyncio.sleep(2)
    raise SystemExit(f"Database migration failed: {last}")

asyncio.run(main())
PY

exec "$@"
