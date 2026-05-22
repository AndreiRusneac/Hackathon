from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SECRET_KEY: str = "actid-hackathon-cluj-2026-super-secret"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480  # 8h for demo
    DATABASE_URL: str = "sqlite:///./actid.db"
    CORS_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173"

    class Config:
        env_file = ".env"


settings = Settings()
