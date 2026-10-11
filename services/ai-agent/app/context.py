import os
import contextvars
from typing import Optional

# Async context variable holding the active projectId for the current request
_current_project_id: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "current_project_id", default=None
)
_default_project_id: Optional[str] = None


def set_current_project_id(project_id: str) -> contextvars.Token:
    """Sets the active projectId for the current async task context and fallback."""
    global _default_project_id
    _default_project_id = project_id
    return _current_project_id.set(project_id)


def reset_current_project_id(token: contextvars.Token) -> None:
    """Resets the context variable to its previous state."""
    _current_project_id.reset(token)


def get_current_project_id() -> str:
    """
    Retrieves the active projectId for the current async execution context.
    Falls back to global default or environment variable if set.
    """
    pid = _current_project_id.get()
    if pid:
        return pid
    if _default_project_id:
        return _default_project_id
    env_pid = os.getenv("EASY_METRICS_PROJECT_ID")
    if env_pid:
        return env_pid
    raise RuntimeError(
        "No active project context found. The request was not properly authenticated."
    )

