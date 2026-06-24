# ---- Build stage ----
FROM python:3.12-slim AS builder

WORKDIR /build
COPY pyproject.toml .
COPY src/ ./src/

RUN pip install --no-cache-dir build && \
    python -m build --wheel

# ---- Runtime stage ----
FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libgdk-pixbuf-2.0-0 \
    libffi-dev \
    shared-mime-info \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /build/dist/*.whl /tmp/
RUN pip install --no-cache-dir /tmp/*.whl && rm /tmp/*.whl

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["uvicorn", "nexus.main:app", "--host", "0.0.0.0", "--port", "8000"]
