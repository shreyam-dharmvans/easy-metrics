import sys
import asyncio

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import init_db_pool, close_db_pool
from .mcp_server import mcp
from .agent import init_agent_graph, close_agent_graph
from .middleware.auth import StatelessAuthMiddleware
from .routers.chat import chat_router
from .routers.threads import threads_router

logger = logging.getLogger("easymetrics.main")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")


# ==============================================================================
# LIFESPAN MANAGER (STARTUP & SHUTDOWN)
# ==============================================================================
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Manages application lifecycles cleanly:
    1. Initializes asyncpg database connection pool.
    2. Compiles LangGraph workflow with PostgreSQL AsyncPostgresSaver memory.
    """
    logger.info("Booting EasyMetrics AI Service on port %d...", settings.agent_port)
    await init_db_pool()
    await init_agent_graph()
    logger.info("EasyMetrics AI Service initialized successfully.")
    yield
    logger.info("Shutting down EasyMetrics AI Service...")
    await close_agent_graph()
    await close_db_pool()
    logger.info("EasyMetrics AI Service shutdown complete.")


# ==============================================================================
# FASTAPI APPLICATION SETUP
# ==============================================================================
app = FastAPI(
    title="EasyMetrics AI & MCP Service",
    description="Production APM Root-Cause Analysis Agent and FastMCP Server",
    version="1.0.0",
    lifespan=lifespan,
)

# 1. CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cors_origin, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Stateless Multi-Tenant Auth Middleware
app.add_middleware(StatelessAuthMiddleware)

# 3. Mount FastMCP Remote Sub-Application (/mcp/sse)
mcp_asgi_app = mcp.http_app(transport="sse")
app.mount("/mcp", mcp_asgi_app)

# 4. Include Modular Routers
app.include_router(chat_router)
app.include_router(threads_router)


# ==============================================================================
# HEALTH CHECK ENDPOINT
# ==============================================================================
@app.get("/health")
async def health_check():
    """Health check endpoint for container orchestrators and load balancers."""
    return {
        "status": "ok",
        "service": "easymetrics-ai-agent",
        "model": settings.groq_model,
        "database": "connected",
        "mcp_mounted": True,
    }
