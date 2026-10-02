import logging
from fastapi import APIRouter, HTTPException, status
from langchain_core.messages import HumanMessage, AIMessage

from ..db import clear_thread_history
from ..agent import get_agent_graph

logger = logging.getLogger("easymetrics.routers.threads")

threads_router = APIRouter(prefix="/api/chat/threads", tags=["Threads"])


# ==============================================================================
# 1. CANONICAL REST: DELETE /api/chat/threads/{thread_id}
# ==============================================================================
@threads_router.delete("/{thread_id}")
async def delete_thread_checkpoints(thread_id: str):
    """
    Cleans up all checkpoint state for the given thread_id in PostgreSQL.
    Invoked when a user clears chat, logs out, or closes their browser session.
    """
    try:
        await clear_thread_history(thread_id)
        return {
            "status": "ok",
            "thread_id": thread_id,
            "message": f"Thread '{thread_id}' checkpoint history deleted successfully from PostgreSQL.",
        }
    except Exception as e:
        logger.exception("Error clearing thread checkpoints for '%s': %s", thread_id, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to clear thread history: {str(e)}",
        )


# ==============================================================================
# 2. CANONICAL REST: GET /api/chat/threads/{thread_id}
# ==============================================================================
@threads_router.get("/{thread_id}")
async def get_thread_history(thread_id: str):
    """
    Retrieves the conversational history for a thread from LangGraph PostgreSQL checkpoints.
    Converts LangChain messages into the frontend ChatMessage schema.
    """
    try:
        graph = get_agent_graph()
        config = {"configurable": {"thread_id": thread_id}}
        state = await graph.aget_state(config)
        raw_messages = state.values.get("messages", []) if state and state.values else []

        result = []
        current_assistant = None

        for idx, msg in enumerate(raw_messages):
            if isinstance(msg, HumanMessage):
                if current_assistant:
                    result.append(current_assistant)
                    current_assistant = None

                content_str = msg.content if isinstance(msg.content, str) else str(msg.content)
                result.append({
                    "id": f"msg_user_{idx}",
                    "role": "user",
                    "content": content_str,
                    "status": "done",
                    "toolCalls": [],
                    "timestamp": idx,
                })

            elif isinstance(msg, AIMessage):
                tools = []
                if hasattr(msg, "tool_calls") and msg.tool_calls:
                    for tc in msg.tool_calls:
                        tools.append({
                            "id": tc.get("id", f"tool_{idx}"),
                            "name": tc.get("name", "tool"),
                            "args": tc.get("args", {}),
                            "status": "completed",
                        })

                content_str = msg.content if isinstance(msg.content, str) else str(msg.content or "")

                if not current_assistant:
                    current_assistant = {
                        "id": f"msg_asst_{idx}",
                        "role": "assistant",
                        "content": content_str,
                        "status": "done",
                        "toolCalls": tools,
                        "timestamp": idx,
                    }
                else:
                    if tools:
                        current_assistant["toolCalls"].extend(tools)
                    if content_str:
                        if current_assistant["content"]:
                            current_assistant["content"] += "\n\n" + content_str
                        else:
                            current_assistant["content"] = content_str

        if current_assistant:
            result.append(current_assistant)

        return {"thread_id": thread_id, "messages": result}
    except Exception as e:
        logger.exception("Error retrieving history for thread '%s': %s", thread_id, e)
        return {"thread_id": thread_id, "messages": []}
