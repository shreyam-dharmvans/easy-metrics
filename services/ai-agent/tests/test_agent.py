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
