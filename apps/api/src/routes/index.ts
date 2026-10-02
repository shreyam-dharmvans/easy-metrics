import { Router } from 'express';
import { requireApiKey, requireAuth } from '../middleware/auth.js';
import { ingestTelemetry } from '../controllers/ingest.js';
import {
  getOverviewMetrics,
  getRouteMetrics,
  getTraces,
  getTraceWaterfall,
} from '../controllers/metrics.js';
import {
  listProjects,
  getCurrentProject,
  createProject,
  renameProject,
  createApiKey,
  deleteApiKey,
  deleteProject,
} from '../controllers/projects.js';
import {
  initiateGoogleAuth,
  handleGoogleCallback,
  getAuthMe,
  handleLogout,
} from '../controllers/auth.js';

export const apiRouter = Router();

// ============================================================================
// 1. TELEMETRY INGESTION (Called by @easy-metrics/node SDK)
// ============================================================================
apiRouter.post('/telemetry/ingest', requireApiKey, ingestTelemetry);

// ============================================================================
// 2. ANALYTICS & DASHBOARD METRICS (Called by Next.js Web Dashboard & AI Agent)
// ============================================================================
apiRouter.get('/metrics/overview', requireAuth, getOverviewMetrics);
apiRouter.get('/metrics/routes', requireAuth, getRouteMetrics);
apiRouter.get('/metrics/traces', requireAuth, getTraces);
apiRouter.get('/metrics/traces/:traceId', requireAuth, getTraceWaterfall);

// ============================================================================
// 3. PROJECT & API KEY MANAGEMENT
// ============================================================================
apiRouter.get('/projects', requireAuth, listProjects);
apiRouter.post('/projects', requireAuth, createProject);
apiRouter.patch('/projects/:id', requireAuth, renameProject);
apiRouter.delete('/projects/:id', requireAuth, deleteProject);
apiRouter.get('/projects/current', requireAuth, getCurrentProject);
apiRouter.post('/projects/api-keys', requireAuth, createApiKey);
apiRouter.delete('/projects/api-keys/:id', requireAuth, deleteApiKey);

// ============================================================================
// 4. AUTHENTICATION & GOOGLE OAUTH
// ============================================================================
apiRouter.get('/auth/google', initiateGoogleAuth);
apiRouter.get('/auth/google/callback', handleGoogleCallback);
apiRouter.get('/auth/me', requireAuth, getAuthMe);
apiRouter.post('/auth/logout', handleLogout);
