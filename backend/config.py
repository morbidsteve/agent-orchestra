"""Application configuration."""

import os


class Settings:
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]
    ORCHESTRATOR_PATH: str = "/workspace/orchestrator.py"
    DEFAULT_MODEL: str = "sonnet"
    PROJECTS_DIR: str = os.path.expanduser("~/orchestra-projects")


settings = Settings()
