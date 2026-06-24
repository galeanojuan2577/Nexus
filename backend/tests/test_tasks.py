from __future__ import annotations

from nexus.tasks.celery_app import celery_app
from nexus.tasks.scan_tasks import engine, run_scan_task


class TestTasks:
    def test_celery_app_config(self):
        assert celery_app.conf.task_serializer == "json"
        assert celery_app.conf.timezone == "UTC"
        assert celery_app.main == "nexus"

    def test_scan_engine_instance(self):
        assert engine is not None
        assert hasattr(engine, "run_scan")

    def test_run_scan_task_signature(self):
        task = run_scan_task
        assert callable(task)
        assert task.__name__ == "run_scan_task"
