"""Application configuration."""


class Settings:
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]
    ORCHESTRATOR_PATH: str = "/workspace/orchestrator.py"
    DEFAULT_MODEL: str = "sonnet"


settings = Settings()
