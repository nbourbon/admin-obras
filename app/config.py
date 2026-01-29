from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    app_name: str = "Construction Expense Manager"
    debug: bool = True

    # Database
    database_url: str = "sqlite:///./data/construction.db"

    # JWT Settings
    secret_key: str = "your-secret-key-change-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24 hours

    # File upload settings
    max_file_size_mb: int = 10
    upload_dir: str = "./uploads"
    allowed_file_types: list[str] = ["application/pdf", "image/jpeg", "image/png"]

    # Exchange rate
    exchange_rate_cache_minutes: int = 60

    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
