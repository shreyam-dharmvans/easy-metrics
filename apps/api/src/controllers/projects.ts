import { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../prisma.js';
import { evictApiKeyCache } from '../middleware/auth.js';

/**
 * Generates an industry-standard prefixed API key:
 * e.g. "em_live_4f89d31b29e0817c91e47a2f"
 */
export function generateApiKey(): string {
  const randomHex = crypto.randomBytes(16).toString('hex');
  return `em_live_${randomHex}`;
}

/**
 * GET /api/v1/projects
 * Lists all projects owned by the user with key and trace counts
 */
export async function listProjects(req: Request, res: Response) {
  try {
    const projects = await prisma.project.findMany({
      where: { ownerId: req.user!.id },
      include: {
        _count: {
          select: {
            apiKeys: true,
            traces: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(projects);
  } catch (error) {
    console.error('Error in listProjects:', error);
    return res.status(500).json({ error: 'Failed to fetch projects' });
  }
}

/**
 * GET /api/v1/projects/current
 * Fetches the active project and its API keys
 */
export async function getCurrentProject(req: Request, res: Response) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: req.project!.id },
      include: {
        apiKeys: {
          select: {
            id: true,
            name: true,
            key: true,
            lastUsedAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Security Isolation: In demo mode, mask all API keys so the real secret is never exposed
    if ((req as any).isDemo && project.apiKeys) {
      project.apiKeys = project.apiKeys.map((k) => ({
        ...k,
        key: 'em_live_••••••••••••••••••••••••••••',
      }));
    }

    return res.json(project);
  } catch (error) {
    console.error('Error in getCurrentProject:', error);
    return res.status(500).json({ error: 'Failed to fetch project' });
  }
}

/**
 * POST /api/v1/projects
 * Creates a new project and auto-generates its default API key in one atomic transaction
 */
export async function createProject(req: Request, res: Response) {
  if ((req as any).isDemo) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Project creation is disabled in read-only Demo Mode. Please sign in with Google.',
    });
  }

  const { name } = req.body;
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  const trimmedName = name.trim();
  const slug =
    trimmedName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '') +
    '-' +
    crypto.randomBytes(3).toString('hex');

  try {
    const newKey = generateApiKey();

    const result = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          name: trimmedName,
          slug,
          ownerId: req.user!.id,
        },
      });

      const apiKey = await tx.apiKey.create({
        data: {
          name: 'Default Key',
          key: newKey,
          projectId: project.id,
        },
      });

      return { project, apiKey };
    });

    return res.status(201).json(result);
  } catch (error) {
    console.error('Error creating project:', error);
    return res.status(500).json({ error: 'Failed to create project' });
  }
}

/**
 * PATCH /api/v1/projects/:id
 * Renames an existing project
 */
export async function renameProject(req: Request, res: Response) {
  if ((req as any).isDemo) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Project renaming is disabled in read-only Demo Mode.',
    });
  }

  const { id } = req.params;
  const { name } = req.body;

  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'New project name is required' });
  }

  try {
    const project = await prisma.project.findFirst({
      where: { id, ownerId: req.user!.id },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const updated = await prisma.project.update({
      where: { id },
      data: { name: name.trim() },
    });

    return res.json(updated);
  } catch (error) {
    console.error('Error renaming project:', error);
    return res.status(500).json({ error: 'Failed to rename project' });
  }
}

/**
 * POST /api/v1/projects/api-keys
 * Creates an additional API key for the active or specified project
 */
export async function createApiKey(req: Request, res: Response) {
  if ((req as any).isDemo) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'API key generation is disabled in read-only Demo Mode. Please sign in with Google.',
    });
  }

  const projectId = req.body.projectId || req.project!.id;
  const name = req.body.name?.trim() || 'API Key';

  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId, ownerId: req.user!.id },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const newKey = generateApiKey();
    const apiKey = await prisma.apiKey.create({
      data: {
        name,
        key: newKey,
        projectId,
      },
    });

    return res.status(201).json(apiKey);
  } catch (error) {
    console.error('Error creating API key:', error);
    return res.status(500).json({ error: 'Failed to create API key' });
  }
}

/**
 * DELETE /api/v1/projects/api-keys/:id
 * Revokes and deletes an API key, invalidating the in-memory cache
 */
export async function deleteApiKey(req: Request, res: Response) {
  if ((req as any).isDemo) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'API key revocation is disabled in read-only Demo Mode.',
    });
  }

  const { id } = req.params;

  try {
    const key = await prisma.apiKey.findFirst({
      where: {
        id,
        project: { ownerId: req.user!.id },
      },
      select: { id: true, key: true },
    });

    if (!key) {
      return res.status(404).json({ error: 'API key not found' });
    }

    await prisma.apiKey.delete({
      where: { id },
    });

    evictApiKeyCache(key.key);

    return res.json({ success: true, message: 'API key revoked' });
  } catch (error) {
    console.error('Error deleting API key:', error);
    return res.status(500).json({ error: 'Failed to delete API key' });
  }
}

/**
 * DELETE /api/v1/projects/:id
 * Deletes a project and cascades all its apiKeys, traces, and spans
 */
export async function deleteProject(req: Request, res: Response) {
  if ((req as any).isDemo) {
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Project deletion is disabled in read-only Demo Mode.',
    });
  }

  const { id } = req.params;

  try {
    const project = await prisma.project.findFirst({
      where: { id, ownerId: req.user!.id },
      include: { apiKeys: { select: { key: true } } },
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Evict all API keys from in-memory cache
    for (const k of project.apiKeys) {
      evictApiKeyCache(k.key);
    }

    await prisma.project.delete({
      where: { id },
    });

    return res.json({ success: true, message: `Project '${project.name}' deleted successfully` });
  } catch (error) {
    console.error('Error deleting project:', error);
    return res.status(500).json({ error: 'Failed to delete project' });
  }
}
