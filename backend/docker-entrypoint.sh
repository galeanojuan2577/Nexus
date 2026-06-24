#!/bin/sh
set -e

echo "Running database migrations..."
python -c "
import asyncio
from nexus.core.database import init_db
asyncio.run(init_db())
"
echo "Database ready."

exec "$@"
