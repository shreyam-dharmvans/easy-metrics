import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/prisma.js';
import { ensureDefaultProject } from '../src/services/seed.js';

describe('Domain: System Health & Authentication Flow', () => {
  beforeAll(async () => {
    await ensureDefaultProject();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('GET /health returns 200 OK with service metadata', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('service', 'easymetrics-api');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('GET /api/v1/auth/google in local dev redirects to callback with dev fallback', async () => {
    const res = await request(app).get('/api/v1/auth/google');

    expect(res.status).toBe(302);
    expect(res.header.location).toBe('/api/v1/auth/google/callback?dev=true');
  });

  it('GET /api/v1/auth/me rejects unauthenticated requests with 401', async () => {
    const res = await request(app).get('/api/v1/auth/me');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('user', null);
  });

  it('GET /api/v1/auth/me returns developer profile when authenticated with session cookie', async () => {
    // 1. Authenticate via dev callback
    const callbackRes = await request(app).get('/api/v1/auth/google/callback?dev=true');
    expect(callbackRes.status).toBe(302);
    const sessionCookie = callbackRes.header['set-cookie'];
    expect(sessionCookie).toBeDefined();

    // 2. Fetch /api/v1/auth/me with session cookie
    const res = await request(app).get('/api/v1/auth/me').set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('user');
    expect(res.body.user).toHaveProperty('email', 'developer@easymetrics.local');
    expect(res.body.user).toHaveProperty('name', 'Demo Developer');
  });

  it('POST /api/v1/auth/logout clears session cookie', async () => {
    const res = await request(app).post('/api/v1/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('success', true);
    expect(res.header['set-cookie']).toBeDefined();
    // Cookie is cleared with max-age=0 or expires in the past
    expect(res.header['set-cookie'][0]).toMatch(/token=;/);
  });

  it('strictly rejects unauthenticated requests with 401 when NODE_ENV is production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      const res = await request(app).get('/api/v1/projects');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Unauthorized');
      expect(res.body.message).toContain('Authentication required');
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });
});
