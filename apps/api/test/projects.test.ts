import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/prisma.js';
import { ensureDefaultProject } from '../src/services/seed.js';

describe('Domain: Multi-Tenant Project & API Key Management', () => {
  beforeAll(async () => {
    await ensureDefaultProject();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('GET /api/v1/projects lists projects with key and trace counts', async () => {
    const res = await request(app).get('/api/v1/projects');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('name');
    expect(res.body[0]).toHaveProperty('_count');
  });

  it('GET /api/v1/projects/current returns current project details', async () => {
    const res = await request(app).get('/api/v1/projects/current');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('name');
    expect(res.body).toHaveProperty('apiKeys');
  });

  it('rejects creating a project with missing name with 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/v1/projects')
      .send({ name: '' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Project name is required');
  });

  it('executes full project and API key lifecycle (Create -> Rename -> Add Key -> Revoke Key -> Delete)', async () => {
    // 1. Create new project
    const createRes = await request(app)
      .post('/api/v1/projects')
      .send({ name: 'Integration Test Service' });

    expect(createRes.status).toBe(201);
    expect(createRes.body.project).toBeDefined();
    expect(createRes.body.project.name).toBe('Integration Test Service');
    expect(createRes.body.apiKey).toBeDefined();
    expect(createRes.body.apiKey.key).toMatch(/^em_live_/);

    const testProjectId = createRes.body.project.id;

    // 2. Rename the project
    const renameRes = await request(app)
      .patch(`/api/v1/projects/${testProjectId}`)
      .send({ name: 'Renamed Test Service' });

    expect(renameRes.status).toBe(200);
    expect(renameRes.body.name).toBe('Renamed Test Service');

    // 3. Create an additional API key
    const addKeyRes = await request(app)
      .post('/api/v1/projects/api-keys')
      .send({
        projectId: testProjectId,
        name: 'Secondary Production Key',
      });

    expect(addKeyRes.status).toBe(201);
    expect(addKeyRes.body.name).toBe('Secondary Production Key');
    expect(addKeyRes.body.key).toMatch(/^em_live_/);

    const secondaryKeyId = addKeyRes.body.id;

    // 4. Revoke the secondary API key
    const deleteKeyRes = await request(app).delete(
      `/api/v1/projects/api-keys/${secondaryKeyId}`
    );

    expect(deleteKeyRes.status).toBe(200);
    expect(deleteKeyRes.body.success).toBe(true);

    // 5. Delete the project (cascades all keys & traces)
    const deleteProjectRes = await request(app).delete(
      `/api/v1/projects/${testProjectId}`
    );

    expect(deleteProjectRes.status).toBe(200);
    expect(deleteProjectRes.body.success).toBe(true);

    // 6. Verify project is deleted in DB
    const deletedRecord = await prisma.project.findUnique({
      where: { id: testProjectId },
    });
    expect(deletedRecord).toBeNull();
  });
});
