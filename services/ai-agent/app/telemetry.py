import logging
from typing import Optional, Dict, Any, List
from datetime import datetime
from .db import get_db_pool

logger = logging.getLogger("easymetrics.telemetry")


# ==============================================================================
# 1. ROUTE HEALTH & LATENCY PERCENTILES
# ==============================================================================
async def fetch_route_health(
    project_id: str,
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
    pool = get_db_pool()

    # Build time condition
    params: List[Any] = [project_id]
    if start_time and end_time:
        time_clause = 'AND "timestamp" >= $2::timestamptz AND "timestamp" <= $3::timestamptz'
        params.extend([start_time, end_time])
        route_param_idx = 4
    else:
        mins = time_window_mins or 60
        time_clause = 'AND "timestamp" >= NOW() - ($2 || \' minutes\')::interval'
        params.append(str(mins))
        route_param_idx = 3

    if route:
        route_clause = f'AND "rootRoute" = ${route_param_idx}'
        params.append(route)
    else:
        route_clause = ""

    query = f"""
        SELECT 
            "rootRoute",
            COUNT(*) AS "totalRequests",
            ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY "durationMs")::numeric, 2) AS "p50Ms",
            ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "durationMs")::numeric, 2) AS "p95Ms",
            COUNT(*) FILTER (WHERE "hasError" = true) AS "errorCount",
            ROUND((COUNT(*) FILTER (WHERE "hasError" = true)::numeric / NULLIF(COUNT(*), 0)::numeric) * 100, 2) AS "errorRatePercent",
            ROUND(MAX("durationMs")::numeric, 2) AS "maxDurationMs",
            (
                SELECT id FROM traces t2 
                WHERE t2."projectId" = traces."projectId" 
                  AND t2."rootRoute" = traces."rootRoute" 
                ORDER BY t2."durationMs" DESC LIMIT 1
            ) AS "slowestTraceId"
        FROM traces
        WHERE "projectId" = $1
          {time_clause}
          {route_clause}
        GROUP BY "projectId", "rootRoute"
        ORDER BY "p95Ms" DESC
        LIMIT 5;
    """

    rows = await pool.fetch(query, *params)
    results = []
    for r in rows:
        results.append({
            "route": r["rootRoute"],
            "totalRequests": r["totalRequests"],
            "p50LatencyMs": float(r["p50Ms"]) if r["p50Ms"] is not None else 0.0,
            "p95LatencyMs": float(r["p95Ms"]) if r["p95Ms"] is not None else 0.0,
            "errorCount": r["errorCount"],
            "errorRatePercent": float(r["errorRatePercent"]) if r["errorRatePercent"] is not None else 0.0,
            "maxDurationMs": float(r["maxDurationMs"]) if r["maxDurationMs"] is not None else 0.0,
            "slowestTraceId": r["slowestTraceId"],
        })

    return {
        "projectId": project_id,
        "queryRoute": route or "TOP_5_SLOWEST",
        "routeCount": len(results),
        "routes": results,
    }


# ==============================================================================
# 2. TRACE WATERFALL & BOTTLENECK ANALYSIS
# ==============================================================================
async def fetch_trace_waterfall(
    project_id: str,
    trace_id: str,
) -> Dict[str, Any]:
    """
    Reconstructs the hierarchical span tree for a trace and automatically
    computes self-times, relative offsets, and the primary latency bottleneck.
    """
    pool = get_db_pool()

    query = """
        SELECT 
            id, "parentSpanId", name, kind, "httpMethod", "httpUrl",
            "durationMs", "startTime", "endTime", "hasError", "errorMessage", "errorStack"
        FROM spans
        WHERE "traceId" = $1 AND "projectId" = $2
        ORDER BY "startTime" ASC;
    """
    rows = await pool.fetch(query, trace_id, project_id)
    if not rows:
        return {"error": f"No spans found for trace_id '{trace_id}' in this project."}

    # Find root span
    root = next((r for r in rows if r["parentSpanId"] is None), rows[0])
    root_start_ms = root["startTime"].timestamp() * 1000.0
    root_duration = max(root["durationMs"], 0.001)

    spans_tree = []
    primary_bottleneck = None
    max_impact_percent = 0.0

    for r in rows:
        span_start_ms = r["startTime"].timestamp() * 1000.0
        offset_ms = round(span_start_ms - root_start_ms, 2)
        duration_ms = round(r["durationMs"], 2)
        impact_percent = round((duration_ms / root_duration) * 100, 1)

        # Flag child span bottlenecks (taking >= 40% of total request time)
        if r["id"] != root["id"] and impact_percent > max_impact_percent:
            max_impact_percent = impact_percent
            if impact_percent >= 40.0:
                primary_bottleneck = {
                    "spanId": r["id"],
                    "name": r["name"],
                    "durationMs": duration_ms,
                    "impactPercent": impact_percent,
                    "url": r["httpUrl"],
                }

        spans_tree.append({
            "id": r["id"],
            "parentSpanId": r["parentSpanId"],
            "name": r["name"],
            "kind": r["kind"],
            "offsetMs": offset_ms,
            "durationMs": duration_ms,
            "impactPercent": impact_percent,
            "hasError": r["hasError"],
            "errorMessage": r["errorMessage"],
        })

    return {
        "traceId": trace_id,
        "rootOperation": root["name"],
        "totalDurationMs": round(root["durationMs"], 2),
        "spanCount": len(spans_tree),
        "primaryBottleneck": primary_bottleneck,
        "spans": spans_tree,
    }


# ==============================================================================
# 3. RECENT ERRORS & STACK TRACES
# ==============================================================================
async def fetch_recent_errors(
    project_id: str,
    limit: int = 5,
) -> List[Dict[str, Any]]:
    """
    Retrieves recent application crashes and 500 errors with full stack traces,
    exact file paths, and line numbers so the AI can suggest code fixes.
    """
    pool = get_db_pool()

    query = """
        SELECT 
            s.id AS "spanId",
            s."traceId",
            t."rootRoute",
            t."statusCode",
            s.name AS "failingSpan",
            s."errorMessage",
            s."errorStack",
            s."startTime"
        FROM spans s
        JOIN traces t ON s."traceId" = t.id
        WHERE s."projectId" = $1 AND s."hasError" = true
        ORDER BY s."startTime" DESC
        LIMIT $2;
    """
    rows = await pool.fetch(query, project_id, min(limit, 20))
    errors = []
    for r in rows:
        errors.append({
            "traceId": r["traceId"],
            "route": r["rootRoute"],
            "statusCode": r["statusCode"],
            "failingSpan": r["failingSpan"],
            "errorMessage": r["errorMessage"],
            "errorStack": r["errorStack"],
            "occurredAt": r["startTime"].isoformat() if r["startTime"] else None,
        })
    return errors


# ==============================================================================
# 4. DYNAMIC SAFE SQL EXECUTION
# ==============================================================================
async def execute_safe_sql(
    project_id: str,
    query: str,
) -> Dict[str, Any]:
    """
    Executes a custom read-only SQL query against EasyMetrics telemetry data.
    Enforces multi-tenant isolation, row limits, and read-only safety.
    Returns SQL error strings on failure so the AI can self-heal/retry.
    """
    pool = get_db_pool()

    clean_query = query.strip()
    upper_query = clean_query.upper()

    # 1. Guardrail: Must be a SELECT or WITH statement
    if not (upper_query.startswith("SELECT") or upper_query.startswith("WITH")):
        return {"error": "Security Violation: Only SELECT and WITH (CTE) queries are permitted."}

    # 2. Guardrail: Reject destructive keywords
    destructive_keywords = [
        "INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE",
        "GRANT", "REVOKE", "CREATE", "EXECUTE", "VACUUM"
    ]
    for kw in destructive_keywords:
        if f" {kw} " in f" {upper_query} ":
            return {"error": f"Security Violation: Destructive statement '{kw}' is prohibited."}

    # 3. Guardrail: Enforce tenant isolation in query
    if project_id not in clean_query and '"projectId"' not in clean_query:
        return {
            "error": f"Tenant Isolation Error: The query MUST filter by \"projectId\" = '{project_id}'."
        }

    # 4. Guardrail: Enforce LIMIT 100
    if "LIMIT" not in upper_query:
        clean_query = f"{clean_query} LIMIT 100"

    # 5. Execute with error capture for AI self-healing
    try:
        rows = await pool.fetch(clean_query)
        serialized_rows = [dict(r) for r in rows]

        # Convert datetimes to ISO format strings
        for row in serialized_rows:
            for k, v in row.items():
                if isinstance(v, datetime):
                    row[k] = v.isoformat()

        return {
            "rowCount": len(serialized_rows),
            "rows": serialized_rows,
        }
    except Exception as e:
        return {
            "error": f"PostgreSQL Execution Error: {str(e)}",
            "hint": "Inspect the schema with get_db_schema() and verify exact column names and types.",
        }


# ==============================================================================
# 5. TELEMETRY DATABASE SCHEMA
# ==============================================================================
def get_telemetry_schema() -> str:
    """Returns the exact PostgreSQL schema and column names for 'traces' and 'spans'."""
    return """
### EasyMetrics Telemetry Database Schema

CRITICAL POSTGRESQL SYNTAX RULES:
1. Column names use camelCase and MUST be enclosed in double quotes in SQL!
   Example: t."id", t."projectId", t."rootRoute", t."durationMs", s."traceId", s."parentSpanId", s."durationMs", s."name", s."kind".
   NEVER write unquoted identifiers like s.traceId or t.projectId (PostgreSQL will fold them to lowercase s.traceid / t.projectid and throw a column does not exist error!).
2. Table join syntax: JOIN spans s ON s."traceId" = t.id
3. Always filter by t."projectId" = '<active_project_id>'.
4. To identify database query spans: check `s.kind = 'INTERNAL'` or `s.name ILIKE '%SELECT%'` or `s.name ILIKE '%INSERT%'` or `s.name ILIKE '%UPDATE%'` or `s.name ILIKE '%DatabaseQuery%'`.
5. To identify external HTTP client spans: check `s.kind = 'CLIENT'`.

#### Table: `traces`
Root incoming HTTP server requests (parent trace).
- `id` (VARCHAR / TEXT, PK): OpenTelemetry 32-character hex trace_id.
- `projectId` (TEXT): Foreign key pointing to the project.
- `serviceName` (TEXT): Name of instrumented microservice.
- `rootRoute` (TEXT): Route path, e.g. "POST /api/checkout", "GET /api/users".
- `httpMethod` (TEXT): "GET", "POST", "PUT", "DELETE", etc.
- `statusCode` (INT): HTTP response status code (e.g. 200, 404, 500).
- `durationMs` (DOUBLE PRECISION): Total execution time of the request in milliseconds.
- `hasError` (BOOLEAN): True if status >= 500 or an unhandled exception occurred.
- `timestamp` (TIMESTAMPTZ): UTC timestamp when request started.

#### Table: `spans`
Individual execution units inside a trace (e.g. DB queries, external HTTP calls).
- `id` (VARCHAR / TEXT, PK): OpenTelemetry 16-character hex span_id.
- `traceId` (TEXT, FK): References `traces.id`.
- `projectId` (TEXT): Project identifier.
- `parentSpanId` (TEXT, NULLABLE): ID of parent span, NULL if root request.
- `name` (TEXT): Span name, e.g. "SELECT * FROM users", "POST https://api.stripe.com/v1/charges".
- `kind` (TEXT): "SERVER" (incoming root), "CLIENT" (outgoing external HTTP calls), "INTERNAL" (database queries, auth, internal functions).
- `httpMethod` (TEXT, NULLABLE): HTTP method if client request.
- `httpUrl` (TEXT, NULLABLE): Full destination URL for outgoing network hops.
- `statusCode` (INT, NULLABLE): Response status code.
- `durationMs` (DOUBLE PRECISION): Execution time in milliseconds.
- `startTime` (TIMESTAMPTZ): Start timestamp.
- `endTime` (TIMESTAMPTZ): Finish timestamp.
- `hasError` (BOOLEAN): True if span failed.
- `errorMessage` (TEXT, NULLABLE): Exception message if failed.
- `errorStack` (TEXT, NULLABLE): Full stack trace with filenames and line numbers.
"""

