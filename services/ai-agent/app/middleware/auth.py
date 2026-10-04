import os
import logging
from fastapi import status
from fastapi.responses import JSONResponse
from jose import jwt, JWTError

from ..config import settings
from ..db import (
    get_project_id_by_api_key,
    verify_project_ownership,
    get_user_default_project_id,
    get_default_demo_project_id,
)
from ..context import set_current_project_id, reset_current_project_id

logger = logging.getLogger("easymetrics.middleware.auth")


class StatelessAuthMiddleware:
    """
    Stateless Security Bouncer & Context Injector (Pure ASGI Middleware):
    1. Extracts 'Authorization: Bearer <token>', 'x-api-key', or 'token' cookie.
    2. Resolves token (API key or JWT) to verified projectId.
    3. Sets the async ContextVar 'current_project_id' for downstream tools.
    4. Bypasses FastMCP (/mcp) and health endpoints without buffering streams.
    """

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope.get("path", "")
        # Skip public health / docs routes
        if path in ["/health", "/docs", "/openapi.json", "/"]:
            await self.app(scope, receive, send)
            return

        headers = dict(scope.get("headers", []))
        auth = headers.get(b"authorization", b"").decode("utf-8")
        api_key_header = headers.get(b"x-api-key", b"").decode("utf-8").strip()
        query_string = scope.get("query_string", b"").decode("utf-8")
        project_header = headers.get(b"x-project-id", b"").decode("utf-8").strip()
        demo_header = headers.get(b"x-easymetrics-demo", b"").decode("utf-8") == "true"
        cookie_header = headers.get(b"cookie", b"").decode("utf-8")
        is_demo = demo_header or ("easymetrics_is_demo=true" in cookie_header) or ("demo=true" in query_string)

        # In Demo Mode, strictly block triggering LLM execution / chat streaming
        if is_demo and (path.startswith("/api/chat") or path.startswith("/chat")):
            response = JSONResponse(
                status_code=status.HTTP_403_FORBIDDEN,
                content={
                    "error": "Forbidden",
                    "message": "AI Copilot messaging is disabled in Demo Mode. Please sign in with Google.",
                },
            )
            await response(scope, receive, send)
            return

        # Extract token from: 1) Authorization header, 2) x-api-key header, 3) 'token' HttpOnly cookie
        cookie_token = None
        if cookie_header:
            for item in cookie_header.split(";"):
                item = item.strip()
                if item.startswith("token="):
                    cookie_token = item.split("=", 1)[1].strip()
                    break

        token = (
            (auth.replace("Bearer ", "").strip() if auth else None)
            or api_key_header
            or cookie_token
            or None
        )
        resolved_id = None

        # 1. Check if token is a machine API key (starts with 'em_live_')
        if token and token.startswith("em_live_"):
            resolved_id = await get_project_id_by_api_key(token)

        # 2. Check if token is a user JWT (from Google OAuth session)
        elif token:
            try:
                payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
                user_id = payload.get("sub") or payload.get("userId")
                target_project = project_header or payload.get("projectId") or payload.get("project_id")

                if user_id:
                    if target_project:
                        is_authorized = await verify_project_ownership(user_id, target_project)
                        if not is_authorized:
                            response = JSONResponse(
                                status_code=status.HTTP_403_FORBIDDEN,
                                content={
                                    "error": "Forbidden",
                                    "message": f"Access denied: User does not own or have access to project '{target_project}'.",
                                },
                            )
                            await response(scope, receive, send)
                            return
                        resolved_id = target_project
                    else:
                        resolved_id = await get_user_default_project_id(user_id)
            except JWTError:
                pass

        # 3. Local Development Fallback if auth is not strictly required
        if not resolved_id:
            # In production, strictly reject unauthenticated requests to protect LLM quota
            if os.getenv("NODE_ENV") == "production":
                response = JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={
                        "error": "Unauthorized",
                        "message": "Authentication required. Please sign in or provide a valid EasyMetrics API key.",
                    },
                )
                await response(scope, receive, send)
                return

            # Dynamically resolve demo project from database
            resolved_id = await get_default_demo_project_id()

        # Set contextvar for this request's async task call stack
        ctx_token = set_current_project_id(resolved_id or "default_project")
        try:
            await self.app(scope, receive, send)
        finally:
            reset_current_project_id(ctx_token)
