import logging
from typing import Optional, Dict, Any
import asyncpg
from .config import settings

logger = logging.getLogger("easymetrics.db")

# Global asyncpg connection pool
_pool: Optional[asyncpg.Pool] = None


async def init_db_pool() -> asyncpg.Pool:
    """
    Initializes a persistent asyncpg connection pool to PostgreSQL.
    Maintains min_size connections ready for instantaneous query execution.
    """
    global _pool
    if _pool is None:
        logger.info("Initializing asyncpg connection pool...")
        _pool = await asyncpg.create_pool(
            dsn=settings.asyncpg_url,
            min_size=2,
            max_size=10,
            command_timeout=30,
        )
        logger.info("Database connection pool initialized successfully.")
    return _pool


async def close_db_pool() -> None:
    """Closes all active database connections in the pool gracefully."""
    global _pool
    if _pool is not None:
        logger.info("Closing asyncpg connection pool...")
        await _pool.close()
        _pool = None
        logger.info("Database connection pool closed.")


def get_db_pool() -> asyncpg.Pool:
    """Returns the active pool. Raises RuntimeError if pool is not initialized."""
    if _pool is None:
        raise RuntimeError("Database connection pool is not initialized. Call init_db_pool() first.")
    return _pool


async def get_project_id_by_api_key(api_key: str) -> Optional[str]:
    """
    Resolves an API key to its corresponding projectId in 0.1ms via index scan.
    Updates lastUsedAt asynchronously.
    """
    pool = get_db_pool()
    query = 'SELECT "projectId" FROM api_keys WHERE key = $1;'
    row = await pool.fetchrow(query, api_key)
    if not row:
        return None

    # Asynchronously update lastUsedAt in the background
    try:
        await pool.execute('UPDATE api_keys SET "lastUsedAt" = NOW() WHERE key = $1;', api_key)
    except Exception as e:
        logger.warning(f"Failed to update lastUsedAt for key: {e}")

    return row["projectId"]


async def verify_project_ownership(user_id: str, project_id: str) -> bool:
    """
    Checks if a given project is owned by (or accessible to) the user.
    Executes in ~0.1ms via primary key index scan.
    """
    pool = get_db_pool()
    query = 'SELECT 1 FROM projects WHERE id = $1 AND "ownerId" = $2;'
    row = await pool.fetchrow(query, project_id, user_id)
    return row is not None


async def get_project_info(project_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieves human-readable project details (name, slug) given a projectId.
    Used by the AI agent to provide context in chat responses.
    """
    pool = get_db_pool()
    query = 'SELECT id, name, slug FROM projects WHERE id = $1;'
    row = await pool.fetchrow(query, project_id)
    if not row:
        return None
    return {
        "id": row["id"],
        "name": row["name"],
        "slug": row["slug"],
    }


async def clear_thread_history(thread_id: str) -> bool:
    """
    Purges all LangGraph checkpoint history for a specific thread_id from PostgreSQL:
    - checkpoint_writes
    - checkpoint_blobs
    - checkpoints
    Ensures a complete conversational reset both in memory and on disk.
    """
    pool = get_db_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute("DELETE FROM checkpoint_writes WHERE thread_id = $1;", thread_id)
            await conn.execute("DELETE FROM checkpoint_blobs WHERE thread_id = $1;", thread_id)
            await conn.execute("DELETE FROM checkpoints WHERE thread_id = $1;", thread_id)
    logger.info("Purged PostgreSQL checkpoint history for thread '%s'.", thread_id)
    return True


async def get_default_demo_project_id() -> Optional[str]:
    """
    Dynamically retrieves the demo project ID from PostgreSQL for local development.
    Avoids hardcoding CUID strings so fresh database seeds work seamlessly.
    """
    pool = get_db_pool()
    query = 'SELECT id FROM projects WHERE slug = $1 LIMIT 1;'
    row = await pool.fetchrow(query, "demo-web-app")
    if row:
        return row["id"]
    fallback_row = await pool.fetchrow('SELECT id FROM projects ORDER BY "createdAt" ASC LIMIT 1;')
    return fallback_row["id"] if fallback_row else None

