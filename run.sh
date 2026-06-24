#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

MODE="${1:-dev}"

cleanup() {
  echo ""
  echo "Shutting down..."
  if [ "$MODE" = "docker" ]; then
    docker compose down 2>/dev/null || true
  else
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
    docker compose down 2>/dev/null || true
  fi
  echo "Done."
}
trap cleanup EXIT INT TERM

if [ "$MODE" = "docker" ]; then
  echo "=========================================="
  echo "  NEXUS - Docker Compose Mode"
  echo "=========================================="
  docker compose up -d --wait
  echo ""
  echo "=========================================="
  echo "  NEXUS is running!"
  echo "  Frontend : http://localhost:5173"
  echo "  API      : http://localhost:8000"
  echo "  Docs     : http://localhost:8000/docs"
  echo "  Prometheus : http://localhost:9090"
  echo "  Grafana    : http://localhost:3000"
  echo "=========================================="
  echo "  Press Ctrl+C to stop"
  echo ""
  docker compose logs -f
  exit 0
fi

# Kill any stale processes
killall -9 uvicorn node 2>/dev/null || true
sleep 1

echo "=========================================="
echo "  NEXUS - Operations & Security Platform"
echo "  Mode: dev (host services)"
echo "=========================================="
echo ""

# 1. Start infrastructure
echo "[1/3] Starting PostgreSQL + Redis..."
docker compose up -d postgres redis --wait 2>&1 | grep -v "Network\s"
echo "  \xE2\x9C\x93 postgres:5432  redis:6379"

# 2. Database init
echo "[2/3] Initializing database..."
cd backend
DATABASE_URL=postgresql+asyncpg://nexus:nexus@localhost:5432/nexus \
python3 -c "
import asyncio
from nexus.core.database import init_db
asyncio.run(init_db())
print('  \xE2\x9C\x93 Tables created')
" 2>&1
cd "$ROOT"

# 3. Start services
echo "[3/3] Starting services..."
cd backend
DATABASE_URL=postgresql+asyncpg://nexus:nexus@localhost:5432/nexus \
  python3 -m uvicorn nexus.main:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!
cd "$ROOT"

cd frontend
VITE_API_URL=http://127.0.0.1:8000 npx vite --host 127.0.0.1 --port 5173 &
FRONTEND_PID=$!
cd "$ROOT"

echo ""
echo "=========================================="
echo "  NEXUS is running!"
echo "  Frontend : http://localhost:5173"
echo "  API      : http://localhost:8000"
echo "  Docs     : http://localhost:8000/docs"
echo "  Health   : http://localhost:8000/health"
echo "=========================================="
echo "  Press Ctrl+C to stop"
echo ""

wait
