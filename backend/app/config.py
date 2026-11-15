from functools import lru_cache
from pathlib import Path

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Resolve independently of the working directory. Never load Next.js .env.local.
    model_config = SettingsConfigDict(
        env_file=Path(__file__).resolve().parents[1] / ".env", extra="ignore"
    )
    database_url: str = "postgresql+psycopg://focustube:focustube@localhost:5433/focustube_fastapi"
    frontend_origin: str = "http://localhost:3000"
    auth_secret: str = Field(min_length=32)
    cookie_secure: bool = False
    session_days: int = Field(default=7, ge=1, le=30)
    google_client_id: str = ""
    google_client_secret: str = ""
    youtube_api_key: str = ""
    supadata_api_key: str = ""
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.5-flash-lite"
    gemini_fallback_model: str = "gemini-2.5-flash"
    rag_enabled: bool = False
    rag_embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"

    @model_validator(mode="after")
    def validate_origin(self):
        from urllib.parse import urlsplit

        self.frontend_origin = self.frontend_origin.rstrip("/")
        origin = urlsplit(self.frontend_origin)
        if origin.scheme not in {"http", "https"} or not origin.netloc or origin.path:
            raise ValueError("FRONTEND_ORIGIN must be an HTTP(S) origin without a path")
        if origin.scheme != "https" and origin.hostname not in {"localhost", "127.0.0.1"}:
            raise ValueError("Non-local FRONTEND_ORIGIN requires HTTPS")
        if origin.scheme == "https" and not self.cookie_secure:
            raise ValueError("COOKIE_SECURE must be true with HTTPS")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
