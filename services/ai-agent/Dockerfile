# ==============================================================================
# EasyMetrics AI Agent & FastMCP Service (services/ai-agent)
# Python 3.12 Slim container for FastAPI + LangGraph + FastMCP
# ==============================================================================

FROM python:3.12-slim

WORKDIR /app

# Install curl for container health checks
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

# Optimize Python execution in Docker
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV AGENT_PORT=8000

# Install dependencies
COPY services/ai-agent/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy service application code
COPY services/ai-agent/app ./app

EXPOSE 8000

# Container healthcheck
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Start Uvicorn ASGI server on port 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
