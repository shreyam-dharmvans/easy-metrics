import os
from pathlib import Path
from pydantic import BaseModel, Field
from dotenv import load_dotenv

# Locate root .env (two levels up from services/ai-agent)
ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
ENV_PATH = ROOT_DIR / ".env"
load_dotenv(dotenv_path=ENV_PATH)
# Also check local .env if present
load_dotenv()


class Settings(BaseModel):
    # Database
    database_url: str = Field(
        default_factory=lambda: os.getenv(
            "DATABASE_URL",
            "postgresql://postgres:postgres@localhost:5432/easymetrics_db",
        )
    )

    # Groq LLM
    groq_api_key: str = Field(
        default_factory=lambda: os.getenv("GROQ_API_KEY", "")
    )
    groq_model: str = Field(
        default_factory=lambda: os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
    )

    # Server Ports & Networking
    agent_port: int = Field(
        default_factory=lambda: int(os.getenv("AGENT_PORT", "8000"))
    )
    mcp_port: int = Field(
        default_factory=lambda: int(os.getenv("MCP_PORT", "8001"))
    )
    cors_origin: str = Field(
        default_factory=lambda: os.getenv("CORS_ORIGIN", "http://localhost:3000")
    )

    # Security
    auth_enabled: bool = Field(
        default_factory=lambda: os.getenv("MCP_AUTH_ENABLED", "true").lower() == "true"
    )
    jwt_secret: str = Field(
        default_factory=lambda: (
            os.getenv("JWT_SECRET")
            or os.getenv("AGENT_JWT_SECRET")
            or "easymetrics-dev-jwt-secret-replace-in-production-min-32-chars"
        )
    )

    @property
    def asyncpg_url(self) -> str:
        """
        Clean DATABASE_URL for asyncpg.
        Strips Prisma-specific query params like '?schema=public'.
        """
        url = self.database_url
        if "?" in url:
            url = url.split("?")[0]
        return url


settings = Settings()

