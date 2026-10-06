import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma.js';

// Extend Express Request type so TypeScript knows req.project and req.user exist
declare global {
  namespace Express {
    interface Request {
      project?: {
        id: string;
      };
      user?: {
        id: string;
        email: string;
      };
    }
  }
}

// In-memory cache for validated API keys (prevents repetitive DB reads on every ingestion batch)
const apiKeyCache = new Map<string, { projectId: string; expiresAt: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute TTL

/**
 * Evicts a key from in-memory cache when revoked
 */
export function evictApiKeyCache(key: string) {
  apiKeyCache.delete(key);
}

/**
 * Middleware for Telemetry Ingestion:
 * Validates 'x-api-key' header against database or in-memory cache.
 */
export async function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const apiKeyHeader = req.headers['x-api-key'];

  if (!apiKeyHeader || typeof apiKeyHeader !== 'string') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: "Missing 'x-api-key' header. Please provide your EasyMetrics project API key.",
    });
  }

  const key = apiKeyHeader.trim();

  // 1. Check in-memory cache first (0.001ms)
  const cached = apiKeyCache.get(key);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    req.project = { id: cached.projectId };
    return next();
  }

  try {
    // 2. Cache miss: Query database
    const foundKey = await prisma.apiKey.findUnique({
      where: { key },
      select: { projectId: true },
    });

    if (!foundKey) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Invalid EasyMetrics API key. Verify the key in your project settings.',
      });
    }

    // 3. Store in cache
    apiKeyCache.set(key, {
      projectId: foundKey.projectId,
      expiresAt: now + CACHE_TTL_MS,
    });

    // Update lastUsedAt asynchronously (fire-and-forget: do not await/block the request)
    prisma.apiKey
      .update({
        where: { key },
        data: { lastUsedAt: new Date() },
      })
      .catch((err) => console.error('Failed to update apiKey lastUsedAt:', err));

    req.project = { id: foundKey.projectId };
    next();
  } catch (error) {
    console.error('Error validating API key:', error);
    return res.status(500).json({ error: 'Internal server error validating API key' });
  }
}

/**
 * STRICTLY COOKIE-ONLY:
 * Extracts the user session JWT from the incoming HttpOnly Cookie.
 * JavaScript cannot read this cookie in the browser, protecting against XSS token theft.
 */
export function extractToken(req: Request): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;

  const match = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Detects whether the incoming request is explicitly from a Demo guest visitor
 */
export function isDemoRequest(req: Request): boolean {
  if (req.query.demo === 'true') return true;
  if (req.headers['x-easymetrics-demo'] === 'true') return true;
  const cookieHeader = req.headers.cookie;
  if (cookieHeader && /(?:^|;\s*)easymetrics_is_demo=true/.test(cookieHeader)) return true;
  return false;
}

/**
 * Middleware for Developer Dashboard & Project Management:
 * Verifies the HttpOnly session cookie, verifies ownership of the requested project,
 * or falls back strictly to the dedicated demo user during local development.
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  const jwtSecret = process.env.JWT_SECRET || 'easymetrics-dev-jwt-secret-replace-in-production-min-32-chars';
  const isDemoVisitor = isDemoRequest(req);
  (req as any).isDemo = isDemoVisitor;

  // 1. If valid HttpOnly session cookie exists, authenticate the human user
  if (token) {
    try {
      // The session token stores ONLY user identity (no baked-in projectId!)
      const decoded = jwt.verify(token, jwtSecret) as { userId: string; email: string };
      req.user = { id: decoded.userId, email: decoded.email };

      // Dynamically resolve active project from query param (?projectId=...) or header (x-project-id)
      const requestedProjectId = (req.query.projectId as string) || (req.headers['x-project-id'] as string);

      if (requestedProjectId) {
        // Enforce multi-tenant security: Ensure the requested project belongs to this user!
        const ownedProject = await prisma.project.findFirst({
          where: { id: requestedProjectId, ownerId: req.user.id },
          select: { id: true },
        });

        if (ownedProject) {
          req.project = { id: ownedProject.id };
        } else {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'You do not have access to the requested project.',
          });
        }
      } else {
        // If no project specified, default to the user's first created project
        const firstProject = await prisma.project.findFirst({
          where: { ownerId: req.user.id },
          select: { id: true },
          orderBy: { createdAt: 'asc' },
        });

        if (firstProject) {
          req.project = { id: firstProject.id };
        }
      }

      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired session cookie.' });
    }
  }

  // 2. Production Guard: In production, strictly reject any request without a valid session cookie
  if (process.env.NODE_ENV === 'production') {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required. Please sign in.',
    });
  }

  // 3. STRICT READ-ONLY ISOLATION FOR DEMO / GUEST VISITORS:
  // Anonymous guest visitors testing demo mode are strictly blocked from modifications!
  if (isDemoVisitor && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Modifications (creating/deleting projects or API keys) are disabled in Demo Mode. Please sign in with Google.',
    });
  }

  // 4. Local Development Convenience:
  // Specifically look up the dedicated Demo Developer & dynamically scope to the requested project
  try {
    const demoUser = await prisma.user.findUnique({
      where: { email: 'developer@easymetrics.local' },
      include: {
        projects: true,
      },
    });

    if (demoUser && demoUser.projects.length > 0) {
      req.user = { id: demoUser.id, email: demoUser.email };

      const requestedProjectId = (req.query.projectId as string) || (req.headers['x-project-id'] as string);
      if (requestedProjectId) {
        const targetProject = demoUser.projects.find((p) => p.id === requestedProjectId);
        if (targetProject) {
          req.project = { id: targetProject.id };
          return next();
        }
      }

      req.project = { id: demoUser.projects[0].id };
      return next();
    }

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Default demo user or project not found.',
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to resolve developer session' });
  }
}
