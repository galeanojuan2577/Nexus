from __future__ import annotations

import asyncio
import logging

from nexus.scanner.engine import ScanEngine
from nexus.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)
engine = ScanEngine()


@celery_app.task(bind=True, max_retries=3, default_retry_delay=30)
def run_scan_task(self, scan_id: str) -> dict:
    try:
        asyncio.run(engine.run_scan(scan_id))
        return {"scan_id": scan_id, "status": "completed"}
    except Exception as e:
        logger.error("Task failed for scan %s: %s", scan_id, e)
        raise self.retry(exc=e)
