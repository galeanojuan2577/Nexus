from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    database_url: str = (
        "postgresql+asyncpg://nexus:nexus@localhost:5432/nexus"
    )
    secret_key: str = "change-me-to-a-random-secret-key"
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24
    ollama_base_url: str = "http://localhost:11434"
    ollama_model: str = "llama3.2"
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/0"
    scanner_timeout: int = 30
    monitor_interval: int = 60
    cors_origins: str = "http://localhost:5173,http://localhost:3000"
    log_level: str = "INFO"
    rate_limit_auth: str = "10/minute"
    rate_limit_api: str = "100/minute"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


settings = Settings()
