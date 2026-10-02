# Contributing to EasyMetrics

Welcome to the **EasyMetrics** contributor guide! 🚀

EasyMetrics is built to be simple and approachable. You do not need to be a distributed systems expert or an SRE to contribute here. Whether you are fixing a small bug, adding a new metric, improving a chart, or tweaking an AI prompt, you are warmly welcome.

This guide gives you the **big-picture story of how the project works**, explains **what each folder does in plain English**, and walks you through **running everything locally in 5 minutes**.

---

## Table of Contents

1. [Core Concepts: What is a Trace and a Span?](#core-concepts-what-is-a-trace-and-a-span)
2. [How Data Moves: The Foundation + 3 Flows](#how-data-moves-the-foundation--3-flows)
   - [The Foundation: How Data Gets into the Database](#the-foundation-how-data-gets-into-the-database)
   - [Flow 1: The Human Dashboard & Waterfall (Web UI)](#flow-1-the-human-dashboard--waterfall-web-ui)
   - [Flow 2: The In-Dashboard AI Copilot (Web Chat)](#flow-2-the-in-dashboard-ai-copilot-web-chat)
   - [Flow 3: The Cursor IDE Integration (FastMCP Server)](#flow-3-the-cursor-ide-integration-fastmcp-server)
3. [Codebase Tour: The Story Behind Each Folder](#codebase-tour-the-story-behind-each-folder)
   - [1. packages/sdk (The Stopwatch in the App)](#1-packagessdk-easy-metricsnode--the-stopwatch-in-the-app)
   - [2. apps/api (The Collector & Organizer)](#2-appsapi--the-collector--organizer)
   - [3. apps/web (What the Developer Sees)](#3-appsweb--what-the-developer-sees)
   - [4. services/ai-agent (The AI Detective)](#4-servicesai-agent--the-ai-detective)
   - [5. examples/demo-app (Your Testing Sandbox)](#5-examplesdemo-app--your-testing-sandbox)
4. [5-Minute Local Development Setup](#5-minute-local-development-setup)
5. [Environment Variables Reference (.env)](#environment-variables-reference-env)
6. [Running Tests & Quality Checks](#running-tests--quality-checks)
7. [Common Gotchas & Troubleshooting](#common-gotchas--troubleshooting)
8. [Submitting a Pull Request](#submitting-a-pull-request)

---

## Core Concepts: What is a Trace and a Span?

Before looking at code, here are the only two concepts you need to know:

Suppose an Express app has a checkout route: `POST /api/orders/checkout`.  
When a user clicks "Pay", that single request takes **2.8 seconds** and runs four steps internally:

```
Entire Request: POST /api/orders/checkout (2,840ms)  <─── [ THIS IS A TRACE ]
│
├── Step 1: Check user login ................. [12ms]    <─── [ SPAN 1 ]
├── Step 2: Database query with JOINs ........ [2,480ms] <─── [ SPAN 2 (The Slow Part!) ]
├── Step 3: Stripe payment call .............. [310ms]   <─── [ SPAN 3 ]
└── Step 4: Save order confirmation .......... [38ms]    <─── [ SPAN 4 ]
```

* **A Trace** is the **entire journey** of a single request from start to finish.
* **A Span** is **one individual step** inside that request (a database query, a payment call, or a middleware check), with its own start time and duration.

> **Think of it like a movie:**  
> A **Trace** is the full movie. A **Span** is a single scene.  
> EasyMetrics records each scene and puts them on a visual timeline so you immediately see which scene dragged on too long.

---

## How Data Moves: The Foundation + 3 Flows

EasyMetrics is not just one linear pipeline. There is **one shared data foundation**, followed by **three completely separate ways that data is used**:

```mermaid
flowchart TD
    subgraph Foundation ["0. Data Collection Foundation"]
        App["User's Express App\n(@easy-metrics/node)"] -->|"Sends recorded spans"| API["Ingestion API\n(apps/api :4000)"]
        API -->|"Saves in DB"| DB[("PostgreSQL\n(Stores traces & spans)")]
    end

    subgraph Consumption ["3 Ways Data is Used"]
        DB -->|"Computes route summaries & waterfalls"| WebUI["Flow 1: Visual Dashboard\n(apps/web :3000)\nHuman developer views route speeds"]
        DB -->|"Fetches trace details directly"| WebAI["Flow 2: AI Copilot Drawer\n(services/ai-agent :8000)\nHuman chats with AI in browser"]
        DB -->|"Provides trace details via MCP"| CursorIDE["Flow 3: Cursor IDE\n(External Editor)\nAI reads waterfall to fix code"]
    end
```

---

### The Foundation: How Data Gets into the Database
1. A developer adds `@easy-metrics/node` to their Express app.
2. When a route executes, the package records each **span** (database queries, external API calls, middleware) and groups them under a shared **trace**.
3. Every 2 seconds, the package sends any newly recorded spans to our backend API (`apps/api` on port `4000`).
4. `apps/api` saves the trace and all its spans into **PostgreSQL**.

Once data is in PostgreSQL, it powers **three distinct flows**:

---

### Flow 1: The Human Dashboard & Waterfall (Web UI)
* **Goal**: A developer opening their browser to see which routes are fast, which are slow, and where the delay occurred.
* **How data moves**:
  1. The developer opens `http://localhost:3000` (`apps/web`) in their browser.
  2. The frontend requests route performance summaries from our backend API (`apps/api` on port `4000`).
  3. The backend API queries PostgreSQL to calculate route response times (average durations, P95 outliers, error rates) and sends that summary back to the frontend to render the routes table.
  4. When the developer clicks on a specific slow request to see what happened, the frontend asks the backend API for that request's trace details.
  5. The backend API fetches all the individual spans (database queries, payment calls) for that trace from PostgreSQL and returns them.
  6. The frontend renders those spans on a visual timeline (the Waterfall), making the slow step instantly visible.
* **Parts involved**: `apps/web` &rarr; `apps/api` &rarr; PostgreSQL.  
  *(The Python AI service is not used here at all).*

---

### Flow 2: The In-Dashboard AI Copilot (Web Chat)
* **Goal**: A developer asking the AI assistant inside the dashboard: *"Why is my checkout route slow?"*
* **How data moves**:
  1. The developer opens the AI drawer in `apps/web` and types a question.
  2. `apps/web` connects to `services/ai-agent` (port `8000`) over Server-Sent Events (SSE).
  3. The Python AI agent inspects the database directly to find the slowest spans for that route, sees that the database query took 2,480ms, and explains the bottleneck in the chat.
* **Parts involved**: `apps/web` &rarr; `services/ai-agent` &rarr; PostgreSQL.

---

### Flow 3: The Cursor IDE Integration (FastMCP Server)
* **Goal**: Cursor IDE talking directly to EasyMetrics to inspect real runtime performance data while writing code.
* **How data moves**:
  1. The developer sets up EasyMetrics in Cursor pointing to `http://localhost:8000/mcp/sse`.
  2. Inside Cursor, the developer types: *"Cursor, check recent slow requests on checkout and fix the slow query in my code."*
  3. Cursor connects directly to our **FastMCP server** in `services/ai-agent`.
  4. FastMCP reads the slow spans from PostgreSQL and returns them to Cursor.
  5. Cursor reads the execution spans, matches the slow query with local project files, and writes the code fix in the developer's editor.
* **Parts involved**: Cursor IDE &rarr; `services/ai-agent` (FastMCP) &rarr; PostgreSQL.  
  *(The Next.js frontend is not used here at all).*

---

## Codebase Tour: The Story Behind Each Folder

Instead of memorizing lines of code, here is the **logical role** of each folder:

```
easy-metrics-monorepo/
├── packages/
│   └── sdk/             # 1. The Stopwatch in the user's app
├── apps/
│   ├── api/             # 2. The Data Collector & Organizer
│   └── web/             # 3. What the developer sees (Dashboard)
├── services/
│   └── ai-agent/        # 4. The AI Detective (FastAPI + Cursor MCP)
└── examples/
    └── demo-app/        # 5. Your testing sandbox
```

---

### 1. `packages/sdk` (`@easy-metrics/node`) — The Stopwatch in the App
This is the npm package developers install into their Express backend. Its sole purpose is to track how long operations take (in milliseconds) and send that data to our backend.

* **`src/index.ts`**: The starting switch. Turns on automatic background tracking for Express routes, database queries, and outgoing HTTP calls.
* **`src/exporter.ts`**: The delivery worker. Instead of sending an HTTP request on every single query (which would slow down the user's app), it gathers recorded spans in memory and sends them in a single batch every 2 seconds.
* **`src/register.ts`**: The zero-code option. If a developer doesn't want to edit their Express code at all (not even the 2 lines of initialization), they can preload this script using `node --import @easy-metrics/node/register server.js` to automatically track the app on boot.
* **`src/types.ts`**: TypeScript types for setup options and data formats.

*👉 **When would you edit this?** If you want to change what request details are collected, enable/disable specific OpenTelemetry plugins (such as GraphQL or Redis), or change how data is packaged and sent to the backend.*

---

### 2. `apps/api` — The Collector & Organizer
This is our Express backend running on port `4000`. Its job is to receive trace and span data from the SDK, save it into PostgreSQL, and answer queries from the frontend.

* **`src/controllers/ingest.ts`**: Receives incoming span deliveries from the SDK, validates that the data format is correct, and saves it into PostgreSQL.
* **`src/controllers/metrics.ts`**: Calculates the numbers shown on the dashboard—such as average route speeds, outlier durations, and the start offsets needed to draw the waterfall.
* **`src/controllers/projects.ts`**: Creates projects and generates API keys so we know which data belongs to which app.
* **`src/controllers/auth.ts`**: Handles developer login sessions.
* **`prisma/schema.prisma`**: The blueprint of our database tables (`Projects`, `Traces`, `Spans`, `ApiKeys`).

*👉 **When would you edit this?** If you want to compute a new performance metric, add a new API route, or change how traces and spans are stored in the database.*

---

### 3. `apps/web` — What the Developer Sees
This is the Next.js frontend running on port `3000`. It turns raw numbers into clean, human-friendly screens.

* **`src/app/dashboard/page.tsx`**: The main overview screen showing overall traffic volume, average response times, and recent speed graphs.
* **`src/app/dashboard/routes/page.tsx`**: The list of all your API routes, ranking them from slowest to fastest so you know where attention is needed.
* **`src/app/dashboard/traces/page.tsx`**: The list of individual requests, letting you filter for slow ones or errors (like 500 status codes).
* **`src/app/dashboard/traces/[traceId]/page.tsx`**: The waterfall page. Draws the visual timeline showing step-by-step where time was spent on a single request.
* **`src/app/dashboard/settings/page.tsx`**: Where you create new projects, copy your API key, and set latency warning thresholds.
* **`src/components/ai/AICopilotDrawer.tsx`**: The slide-out chat window where developers can talk to the AI assistant.

*👉 **When would you edit this?** If you want to improve UI charts, refine the waterfall timeline, or polish the design.*

---

### 4. `services/ai-agent` — The AI Detective
This is the Python service running on port `8000`. Its job is to look at the database and figure out *why* a request was slow.

* **`app/agent.py`**: The brain of the AI assistant. Decides which diagnostic questions to ask and which tools to run to find the root cause of a slowdown.
* **`app/tools.py`**: The diagnostic tools the AI has access to—such as *"find the slowest routes"*, *"list recent errors"*, or *"get the full waterfall for this request"*.
* **`app/mcp_server.py`**: The bridge for Cursor IDE. Allows Cursor to directly call our tools so it can read runtime performance data right into your editor.
* **`app/routers/chat.py`**: Powers the real-time chat drawer in the dashboard, streaming the AI's explanation back word-by-word.

*👉 **When would you edit this?** If you want to give the AI new diagnostic tools, improve its analysis prompts, or enhance the FastMCP integration.*

---

### 5. `examples/demo-app` — Your Testing Sandbox
A small sample e-commerce store running on port `5000` that imports `@easy-metrics/node`.

* **How the link works**: Because of npm workspaces, this demo app automatically uses your local code in `packages/sdk`. **Any change you make in `packages/sdk` is immediately live in `demo-app` without publishing to npm.**
* **`server.js`**: Runs a sample Express store with fast routes, slow database queries, and simulated errors.
* **`simulate-traffic.js`**: Automatically sends requests to the store so your local dashboard immediately has live data and waterfalls to explore.

---

## 5-Minute Local Development Setup

Follow these steps to run the complete platform on your machine:

### 1. Prerequisites
Make sure you have:
* **Node.js**: `>= 20.11.0` (`node -v`)
* **npm**: `>= 10.0.0` (`npm -v`)
* **Docker & Docker Compose**: (`docker compose version`)
* **Python**: `3.11` or `3.12` (`python --version`)

---

### 2. Fork & Clone
```bash
git clone https://github.com/your-username/easy-metrics.git
cd easy-metrics
```

---

### 3. Setup Environment Variables
Copy the example configuration file:
```bash
cp .env.example .env
```
*(Add your `GROQ_API_KEY` in `.env`—get a free key at [console.groq.com](https://console.groq.com). This is required for the AI Copilot and FastMCP features to work).*

---

### 4. Install Dependencies
From the repository root:
```bash
npm install
```
This installs all workspace dependencies and sets up the internal local symlinks.

---

### 5. Setup Python Virtual Environment (for the AI Agent)
```bash
cd services/ai-agent
python -m venv venv

# Activate venv:
# On Windows (PowerShell):
.\venv\Scripts\Activate.ps1
# On macOS/Linux:
source venv/bin/activate

# Install dependencies:
pip install -r requirements.txt
cd ../..
```

---

### 6. Start PostgreSQL with Docker
```bash
docker compose up -d
```
Check that the database is running:
```bash
docker compose ps
```

---

### 7. Create Database Tables
Push the Prisma schema to your local database container:
```bash
npm run prisma:push --workspace=apps/api
```

---

### 8. Run All Services Concurrently
```bash
npm run dev
```

This single command boots all four parts of the platform together:
* 🌐 **Dashboard UI**: `http://localhost:3000`
* ⚡ **Ingestion & Query API**: `http://localhost:4000`
* 🧠 **AI Agent & FastMCP**: `http://localhost:8000` (FastMCP at `http://localhost:8000/mcp/sse`)
* 🛒 **Demo App**: `http://localhost:5000`

---

### 9. Generate Live Test Traffic (Optional)
Want to see live charts and waterfalls right away?  
In a second terminal window, run:
```bash
npm run simulate
```
This sends a continuous stream of fast searches, slow checkout queries, and occasional errors to the demo app. Open `http://localhost:3000` to watch the live graphs update in real time!

---

### 🐳 Prefer running everything in Docker? (Optional)
If you prefer running the entire production stack inside Docker containers without installing Node or Python on your host:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

---

## Environment Variables Reference (`.env`)

| Variable | Required? | Default / Example | Purpose |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | **Yes** | `postgresql://postgres:postgres@localhost:5432/easymetrics_db?schema=public` | PostgreSQL connection string for Prisma and asyncpg. |
| `API_PORT` | Optional | `4000` | Port for the Express Ingestion & Query API. |
| `JWT_SECRET` | **Yes** | `min-32-chars-secret-key...` | Cryptographic secret for signing session cookies. |
| `CORS_ORIGIN` | Optional | `http://localhost:3000` | Allowed frontend origin for browser fetch requests. |
| `AGENT_PORT` | Optional | `8000` | Port for the FastAPI AI Agent & FastMCP service. |
| `GROQ_API_KEY` | **Required** (for AI) | `gsk_...` | Required for the AI Copilot and FastMCP features. Get a free key at [console.groq.com](https://console.groq.com). |
| `GROQ_MODEL` | Optional | `llama-3.3-70b-versatile` | LLM model used for root-cause analysis. |
| `DEMO_PORT` | Optional | `5000` | Port for the local Express testing demo app. |
| `GOOGLE_CLIENT_ID` | Optional | `...` | Google OAuth Client ID (in local dev, falls back automatically to demo mode). |
| `GOOGLE_CLIENT_SECRET`| Optional | `...` | Google OAuth Client Secret. |

---

## Running Tests & Quality Checks

Always ensure tests pass before opening a Pull Request:

### 1. Run All Tests with One Command (27 tests total)
```bash
npm run test:all
```
This runs the entire test suite across both Node.js and Python in a single command (**22 Vitest tests + 5 Pytest tests**).

---

### Prefer to test individual parts?
* **Node.js & API Tests only (22 tests)**:
  ```bash
  npm test
  ```
  Runs Vitest tests verifying span batching, API key verification, metric aggregations, and database persistence.

* **Python AI Agent Tests only (5 tests)**:
  ```bash
  npm run test:ai
  ```
  Runs Pytest verifying FastAPI lifespan, LangGraph database checkpointing, and authentication guards.

---

### 2. Typecheck & Build Monorepo
```bash
npm run build
```
Ensures TypeScript compiles with zero errors across all workspaces and verifies the Next.js production build.

---

## Common Gotchas & Troubleshooting

| Problem | Cause | Solution |
| :--- | :--- | :--- |
| `Bind for 0.0.0.0:5432 failed: port is already allocated` | Another local PostgreSQL instance is already running on your computer on port 5432. | Stop your local PostgreSQL service (`net stop postgresql` on Windows, or `sudo service postgresql stop` on Linux) before running `docker compose up -d`. |
| `Cannot find module '@prisma/client'` | Prisma client has not been generated on your machine yet. | Run `npm run prisma:generate --workspace=apps/api`. |
| `FastMCP: WindowsSelectorEventLoopPolicy` error on Windows | Default Windows asyncio event loop conflicts with subprocessing. | Handled automatically in `services/ai-agent/app/main.py`. Ensure you run with Python 3.11 or 3.12. |
| Python `No module named app` when running pytest | Python path does not include the service root. | Run pytest directly from inside the service directory: `cd services/ai-agent && pytest tests/`. |

---

## Submitting a Pull Request

1. **Create a Feature Branch**:
   ```bash
   git checkout -b feat/add-redis-tracing
   ```

2. **Commit Using Conventional Commits**:
   * `feat:` New features or capabilities
   * `fix:` Bug fixes
   * `test:` Adding or updating tests
   * `perf:` Performance improvements
   * `docs:` Documentation changes
   * `refactor:` Code improvements without changing functionality

3. **Push & Open PR**:
   Push your branch to your fork on GitHub and open a Pull Request against `main`.

4. **CI Verification**:
   Ensure all GitHub Actions CI checks turn **Green ✅**. If any check fails, inspect the logs, fix the issue locally, and push an update.

---

Thank you for helping make open-source observability simple and accessible! 💙
