.PHONY: run run-docker stop clean test test-e2e lint build

run:
	./run.sh dev

run-docker:
	./run.sh docker

stop:
	docker compose down
	-pkill -f "uvicorn nexus.main" 2>/dev/null || true
	-pkill -f "vite" 2>/dev/null || true

clean: stop
	docker compose down -v
	rm -rf backend/dist backend/*.egg-info
	rm -rf frontend/dist

restart: stop run

test:
	cd backend && python3 -m pytest tests/ -q

test-e2e:
	cd frontend && npx playwright test

lint:
	cd backend && python3 -m ruff check src/
	cd frontend && npx tsc --noEmit

build:
	cd backend && python3 -m build --wheel
	cd frontend && npx vite build

docker-build:
	docker compose build --no-cache

install-deps:
	cd backend && pip install --break-system-packages -e ".[dev]"
	cd frontend && npm install
