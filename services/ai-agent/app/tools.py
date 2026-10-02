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
async def get_project_context() -> Dict[str, Any]:
    """
    Retrieves project metadata (name, slug, id) for the active project context.
    Provides basic service context to the AI before inspecting telemetry.
    """
    project_id = get_current_project_id()
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
    project_id = get_current_project_id()
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
    project_id = get_current_project_id()
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
    project_id = get_current_project_id()
    return await fetch_recent_errors(
        project_id=project_id,
        limit=limit,
    )


async def get_db_schema() -> str:
    """
    Returns the exact PostgreSQL schema and column names for 'traces' and 'spans'.
    Used by the AI to compose accurate, hallucination-free SQL queries.
    """
    return get_telemetry_schema()


async def execute_custom_sql(query: str) -> Dict[str, Any]:
    """
    Executes a custom read-only SQL query against EasyMetrics telemetry data.
    Enforces tenant isolation, row limits, and read-only safety.
    Returns SQL error strings on failure so the AI can self-heal/retry.
    """
    project_id = get_current_project_id()
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

