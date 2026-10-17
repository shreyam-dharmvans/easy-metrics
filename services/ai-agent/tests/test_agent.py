import os
import pytest
from starlette.testclient import TestClient
from app.main import app

@pytest.fixture(scope="module")
def client():
    """
    Module-scoped TestClient that manages FastAPI lifespan startup and shutdown.
    Initializes PostgreSQL connection pool and LangGraph agent workflow.
    """
    with TestClient(app) as test_client:
        yield test_client


def test_health_check(client):
    """Verify that the /health endpoint returns service status and model metadata."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "easymetrics-ai-agent"
    assert "model" in data
    assert data["database"] == "connected"


def test_get_thread_history(client):
    """Verify GET /api/chat/threads/{thread_id} returns thread history structure."""
    test_thread_id = "test_integration_thread_001"
    response = client.get(f"/api/chat/threads/{test_thread_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["thread_id"] == test_thread_id
    assert isinstance(data["messages"], list)


def test_delete_thread_history(client):
    """Verify DELETE /api/chat/threads/{thread_id} clears checkpoints."""
    test_thread_id = "test_integration_thread_001"
    response = client.delete(f"/api/chat/threads/{test_thread_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["thread_id"] == test_thread_id


def test_auth_middleware_production_guard(client, monkeypatch):
    """
    Verify that in production mode (NODE_ENV=production), requests without credentials
    are strictly rejected with 401 Unauthorized.
    """
    monkeypatch.setenv("NODE_ENV", "production")
    response = client.get("/api/chat/threads/protected_thread_id")
    assert response.status_code == 401
    assert response.json()["error"] == "Unauthorized"
    assert "Authentication required" in response.json()["message"]


def test_demo_mode_blocks_chat_access(client):
    """
    Verify that anonymous visitors in Demo Mode (x-easymetrics-demo: true)
    are strictly forbidden from triggering LLM chat operations.
    """
    response = client.post(
        "/api/chat/stream",
        headers={"x-easymetrics-demo": "true"},
        json={"message": "Analyze errors", "thread_id": "demo-thread-123"},
    )
    assert response.status_code == 403
    assert response.json()["error"] == "Forbidden"
    assert "disabled in Demo Mode" in response.json()["message"]


def test_mcp_streamable_http_initialize(client):
    """
    Verify that MCP Streamable HTTP endpoint handles JSON-RPC initialize
    over POST /mcp (used by Antigravity, Claude Desktop).
    """
    response = client.post(
        "/mcp",
        json={
            "jsonrpc": "2.0",
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "test-client", "version": "1.0"},
            },
            "id": 1,
        },
        headers={"accept": "application/json, text/event-stream"},
    )
    assert response.status_code == 200
    assert "event: message" in response.text
    assert "protocolVersion" in response.text


def test_mcp_routes_registered(client):
    """
    Verify that MCP Streamable HTTP (/) and SSE (/sse, /messages)
    routes are registered in the unified MCP application mounted at /mcp.
    """
    from app.main import mcp_unified_app
    route_paths = [r.path for r in mcp_unified_app.routes]
    assert "/" in route_paths
    assert "/sse" in route_paths
    assert "/messages" in route_paths



