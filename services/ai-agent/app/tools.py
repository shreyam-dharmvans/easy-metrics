import logging
from typing import Optional, Dict, Any, List

from .context import get_current_project_id
from .db import get_project_info
from .telemetry import (
    fetch_route_health,
    fetch_trace_waterfall,
    fetch_recent_errors,
    execute_safe_sql,
    get_telemetry_schema,
)

logger = logging.getLogger("easymetrics.tools")


# ==============================================================================
# UNIVERSAL TOOLS (Defined ONCE for both FastMCP and LangGraph)
# ==============================================================================
async def _ensure_active_context() -> str:
    """Ensures database connection pool is alive and returns active project_id."""
    import os
    from .db import init_db_pool, get_project_id_by_api_key, get_default_demo_project_id
    from .context import set_current_project_id
    await init_db_pool()
    try:
        return get_current_project_id()
    except RuntimeError:
        pass

    # Auto-resolve for standalone MCP invocation
    key = os.getenv("EASY_METRICS_API_KEY", "em_live_local_dev_key")
    pid = await get_project_id_by_api_key(key)
    if not pid:
        pid = await get_default_demo_project_id()
    if pid:
        set_current_project_id(pid)
        return pid
    raise RuntimeError("No active project context found. Configure EASY_METRICS_API_KEY or seed database.")


async def get_project_context() -> Dict[str, Any]:
    """
    Retrieves project metadata (name, slug, id) for the active project context.
    Provides basic service context to the AI before inspecting telemetry.
    """
    project_id = await _ensure_active_context()
    info = await get_project_info(project_id)
    return info or {"error": "Project not found"}


async def get_route_health(
    route: Optional[str] = None,
    time_window_mins: Optional[int] = 60,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Computes throughput (RPM), latency percentiles (P50, P95), and error rates.
    Supports either relative time (last N minutes) or absolute ISO time windows.
    If 'route' is omitted, returns the Top 5 slowest routes across the project.
    """
    project_id = await _ensure_active_context()
    return await fetch_route_health(
        project_id=project_id,
        route=route,
        time_window_mins=time_window_mins,
        start_time=start_time,
        end_time=end_time,
    )


async def get_trace_waterfall(trace_id: str) -> Dict[str, Any]:
    """
    Reconstructs the hierarchical execution timeline (waterfall flamegraph)
    for a specific trace, calculates relative offsets, and identifies the
    primary latency bottleneck.
    """
    project_id = await _ensure_active_context()
    return await fetch_trace_waterfall(
        project_id=project_id,
        trace_id=trace_id,
    )


async def get_recent_errors(limit: int = 5) -> List[Dict[str, Any]]:
    """
    Retrieves recent application crashes and 500 errors with full stack traces,
    exact file paths, and line numbers so the AI can diagnose root causes and
    suggest code fixes.
    """
    project_id = await _ensure_active_context()
    return await fetch_recent_errors(
        project_id=project_id,
        limit=limit,
    )


async def get_db_schema() -> str:
    """
    Returns the exact PostgreSQL schema and column names for 'traces' and 'spans'.
    Used by the AI to compose accurate, hallucination-free SQL queries.
    """
    await _ensure_active_context()
    return get_telemetry_schema()


async def execute_custom_sql(query: str) -> Dict[str, Any]:
    """
    Executes a custom read-only SQL query against EasyMetrics telemetry data.
    Enforces tenant isolation, row limits, and read-only safety.
    Returns SQL error strings on failure so the AI can self-heal/retry.
    """
    project_id = await _ensure_active_context()
    return await execute_safe_sql(
        project_id=project_id,
        query=query,
    )


ALL_TOOLS = [
    get_project_context,
    get_route_health,
    get_trace_waterfall,
    get_recent_errors,
    get_db_schema,
    execute_custom_sql,
]
TOOL_MAP = {t.__name__: t for t in ALL_TOOLS}

