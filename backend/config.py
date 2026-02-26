"""Application configuration."""

import logging
import os

# Ensure orchestrator logs go to stdout (visible in Docker)
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


class Settings:
    HOST: str = os.environ.get("BACKEND_HOST", "127.0.0.1")
    PORT: int = 8000
    ALLOWED_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]
    ORCHESTRATOR_PATH: str = "/workspace/orchestrator.py"
    DEFAULT_MODEL: str = "sonnet"
    PROJECTS_DIR: str = os.path.expanduser("~/orchestra-projects")
    BROWSE_ROOT: str = os.environ.get("BROWSE_ROOT", "/")
    ALLOW_HOST: bool = os.environ.get("ORCHESTRA_ALLOW_HOST", "").lower() == "true"


settings = Settings()
