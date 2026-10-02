import json
import logging
from typing import Optional
from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from langchain_core.messages import HumanMessage

from ..config import settings
from ..context import get_current_project_id, set_current_project_id, reset_current_project_id
from ..agent import get_agent_graph

logger = logging.getLogger("easymetrics.routers.chat")

chat_router = APIRouter(prefix="/api/chat", tags=["Chat"])


class ChatRequest(BaseModel):
    message: str
    thread_id: Optional[str] = "default_session"


@chat_router.post("/stream")
async def chat_stream(request: Request, body: ChatRequest):
    """
    Real-Time Server-Sent Events (SSE) streaming endpoint for Next.js Web Dashboard.
    Streams live thinking/tool pills and word-by-word LLM answers.
    """
    project_id = getattr(request.state, "project_id", None) or get_current_project_id()

    async def event_generator():
        ctx_token = set_current_project_id(project_id)
        try:
            if not settings.groq_api_key or settings.groq_api_key.startswith("gsk_your"):
                logger.error("GROQ_API_KEY is not configured on the server.")
                yield f"data: {json.dumps({'type': 'error', 'message': 'AI Diagnostic service is temporarily unavailable. Please try again later.'})}\n\n"
                yield f"data: {json.dumps({'type': 'done'})}\n\n"
                return

            graph = get_agent_graph()
            input_data = {
                "messages": [HumanMessage(content=body.message)],
            }
            # thread_id passed in config for LangGraph checkpointer
            config = {"configurable": {"thread_id": body.thread_id}}

            # Stream LangGraph execution events (astream_events v2)
            async for event in graph.astream_events(input_data, config=config, version="v2"):
                kind = event["event"]

                # 1. Tool execution started: emit thinking pill
                if kind == "on_tool_start":
                    tool_name = event.get("name", "")
                    tool_input = event.get("data", {}).get("input", {})
                    yield f"data: {json.dumps({'type': 'tool_start', 'tool': tool_name, 'args': tool_input})}\n\n"

                # 2. Tool execution completed: emit pill done status
                elif kind == "on_tool_end":
                    tool_name = event.get("name", "")
                    yield f"data: {json.dumps({'type': 'tool_end', 'tool': tool_name, 'status': 'completed'})}\n\n"

                # 3. Stream final answer tokens word-by-word
                elif kind == "on_chat_model_stream":
                    chunk = event.get("data", {}).get("chunk")
                    if (
                        chunk
                        and hasattr(chunk, "content")
                        and chunk.content
                        and not getattr(chunk, "tool_call_chunks", None)
                    ):
                        yield f"data: {json.dumps({'type': 'token', 'content': chunk.content})}\n\n"

            # 4. Stream finished signal
            yield f"data: {json.dumps({'type': 'done'})}\n\n"

        except Exception as e:
            logger.exception("Error in chat_stream:")
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        finally:
            reset_current_project_id(ctx_token)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
