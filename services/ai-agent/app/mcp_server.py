import os
import sys
import asyncio
import logging

from fastmcp import FastMCP
from .tools import ALL_TOOLS
from .context import set_current_project_id
from .db import init_db_pool, close_db_pool, get_project_id_by_api_key, get_default_demo_project_id

logger = logging.getLogger("easymetrics.mcp")

# Initialize FastMCP Server
mcp = FastMCP("EasyMetrics APM")

# Register all universal tools into FastMCP
for tool_fn in ALL_TOOLS:
    mcp.add_tool(tool_fn)


# ==============================================================================
# LOCAL STDIO & REMOTE SSE RUNNER
# ==============================================================================
async def _run_stdio_with_auth():
    """
    Initializes database pool and resolves local environment API key
    before starting local stdio transport for Cursor / VS Code.
    Falls back dynamically to the local demo project if the key is not found.
    """
    await init_db_pool()
    key = os.getenv("EASY_METRICS_API_KEY", "em_live_local_dev_key")
    project_id = await get_project_id_by_api_key(key)
    if not project_id:
        project_id = await get_default_demo_project_id()

    if not project_id:
        raise PermissionError(f"Unauthorized: API key '{key}' is invalid and no demo project found in database.")
    
    # Set the context variable for the local process
    set_current_project_id(project_id)
    logger.info(f"Local FastMCP initialized for project: {project_id}")


if __name__ == "__main__":
    if "--sse" in sys.argv:
        # Remote Cloud Mode: HTTP/SSE on port 8001
        print("Starting EasyMetrics FastMCP Server over SSE on port 8001...")
        mcp.run(transport="sse", host="0.0.0.0", port=8001)
    else:
        # Local IDE Mode: Initialize DB and stdio transport for Cursor
        asyncio.run(_run_stdio_with_auth())
        mcp.run(transport="stdio")
