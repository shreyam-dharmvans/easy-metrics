import sys
import asyncio

# Fix for Windows asyncio ProactorEventLoop compatibility with psycopg async
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import json
import logging
from typing import Annotated, TypedDict, List, Dict, Any, Optional

from langchain_core.messages import (
    BaseMessage,
    SystemMessage,
    HumanMessage,
    ToolMessage,
    AIMessage,
)
from langchain_groq import ChatGroq
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from psycopg_pool import AsyncConnectionPool
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

from .config import settings
from .tools import ALL_TOOLS, TOOL_MAP
from .context import set_current_project_id

logger = logging.getLogger("easymetrics.agent")

# ==============================================================================
# SRE SYSTEM PROMPT
# ==============================================================================
SRE_SYSTEM_PROMPT = """You are the EasyMetrics AI SRE Copilot & Observability Specialist.
Your mission is to analyze live production runtime telemetry (routes, traces, spans, database queries, and errors) and present ground-truth facts to developers so they can understand runtime behavior and supply accurate context to their AI IDE (such as Cursor, GitHub Copilot, or Gemini).

CRITICAL CONSTRAINTS:
1. No Source Code Access:
   - You only have access to runtime APM telemetry (timings, span inputs/parameters, outputs/exceptions, stack traces, and database schemas).
   - You do NOT have the user's application codebase or repository files.
   - NEVER hallucinate or invent dummy application source code files, classes, or fictional implementations.

2. Ground-Truth Runtime Telemetry Analysis:
   - When asked about performance or slow routes, fetch route metrics and identify the slowest or failing traces.
   - For any trace, examine its spans chronologically:
     a) Cite exact total request duration and HTTP status.
     b) Identify the primary bottleneck: any child span consuming >= 40% of the total request time (or >= slow threshold).
     c) Detect sequential await anti-patterns: consecutive database queries or external API calls that executed serially instead of concurrently with Promise.all().
     d) Highlight unhandled exceptions, raw error messages, and stack trace frames.

3. Developer Handoff to AI IDEs (Cursor / Copilot / Gemini):
   - Summarize your findings as concrete, empirical runtime observations.
   - When appropriate, format a structured summary that the developer can easily copy-paste into Cursor or Copilot to guide their code changes.
   - Emphasize architectural recommendations (e.g. index candidate on column X, caching recommendation for key Y, parallelizing sequential queries A and B) rather than generating full source code files.

4. Custom Metrics / SQL:
   - If the user asks an ad-hoc statistical question, call get_db_schema first to verify exact column names.
   - Write safe, read-only SELECT queries via execute_custom_sql.
   - If a query fails, read the PostgreSQL error message and self-heal.

5. Tone:
   - Factual, concise, authoritative, and developer-friendly. Avoid boilerplate and conversational fluff. Use markdown tables, bold metrics, and clean bulleted lists.
"""


from langgraph.graph import StateGraph, START, END, MessagesState

# ==============================================================================
# LLM & GRAPH NODES
# ==============================================================================
def get_llm():
    """Initializes the Groq LLM model with bound universal tools."""
    return ChatGroq(
        model=settings.groq_model,
        api_key=settings.groq_api_key or "placeholder_key",
        temperature=0.1,
        max_retries=2,
    ).bind_tools(ALL_TOOLS)


async def agent_node(state: MessagesState) -> Dict[str, Any]:
    """
    Reasoning node: Groq evaluates the user prompt and conversation history,
    deciding whether to call tools or formulate the final answer.
    Applies sliding window trimming to stay strictly within Groq TPM limits.
    """
    raw_messages = state["messages"]

    # Filter out existing system message to manage window cleanly
    non_system = [m for m in raw_messages if not isinstance(m, SystemMessage)]

    # Keep a sliding window of the most recent messages (last 6)
    if len(non_system) > 6:
        trimmed = non_system[-6:]
        # Ensure we don't start with an orphaned ToolMessage without its preceding AIMessage
        while trimmed and isinstance(trimmed[0], ToolMessage):
            trimmed = trimmed[1:]
        non_system = trimmed

    # Budget tool output sizes to guarantee we stay comfortably under the 8,000 TPM limit
    budgeted_messages = []
    for m in non_system:
        if isinstance(m, ToolMessage) and len(str(m.content)) > 2500:
            truncated = str(m.content)[:2500] + "\n... [telemetry truncated to stay within token budget]"
            budgeted_messages.append(ToolMessage(content=truncated, tool_call_id=m.tool_call_id, name=getattr(m, "name", None)))
        else:
            budgeted_messages.append(m)

    messages_to_send = [SystemMessage(content=SRE_SYSTEM_PROMPT)] + budgeted_messages

    llm = get_llm()
    response = await llm.ainvoke(messages_to_send)
    return {"messages": [response]}


from langgraph.prebuilt import ToolNode, tools_condition

# ==============================================================================
# WORKFLOW DEFINITION USING STANDARD LANGGRAPH MESSAGESSTATE
# ==============================================================================
workflow = StateGraph(MessagesState)
workflow.add_node("agent", agent_node)
workflow.add_node("tools", ToolNode(ALL_TOOLS))

workflow.add_edge(START, "agent")
workflow.add_conditional_edges("agent", tools_condition)
workflow.add_edge("tools", "agent")


# ==============================================================================
# ASYNC POSTGRES CHECKPOINTER LIFECYCLE
# ==============================================================================
_checkpointer_pool: Optional[AsyncConnectionPool] = None
_checkpointer: Optional[AsyncPostgresSaver] = None
_compiled_graph = None


async def init_agent_graph():
    """
    Initializes the PostgreSQL connection pool for LangGraph checkpoints,
    sets up the tables, and compiles the workflow with persistent PostgreSQL memory.
    """
    global _checkpointer_pool, _checkpointer, _compiled_graph
    if _compiled_graph is None:
        logger.info("Initializing LangGraph AsyncPostgresSaver checkpointer...")
        _checkpointer_pool = AsyncConnectionPool(
            conninfo=settings.asyncpg_url,
            max_size=10,
            kwargs={"autocommit": True},
            open=False,
        )
        await _checkpointer_pool.open()
        _checkpointer = AsyncPostgresSaver(_checkpointer_pool)
        await _checkpointer.setup()
        _compiled_graph = workflow.compile(checkpointer=_checkpointer)
        logger.info("LangGraph agent compiled with persistent PostgreSQL memory.")
    return _compiled_graph


async def close_agent_graph():
    """Closes the checkpointer connection pool on application shutdown."""
    global _checkpointer_pool, _compiled_graph
    if _checkpointer_pool is not None:
        logger.info("Closing LangGraph checkpointer connection pool...")
        await _checkpointer_pool.close()
        _checkpointer_pool = None
        _compiled_graph = None


def get_agent_graph():
    """Returns the compiled graph. Raises RuntimeError if not initialized."""
    if _compiled_graph is None:
        raise RuntimeError("Agent graph is not initialized. Call init_agent_graph() first.")
    return _compiled_graph
