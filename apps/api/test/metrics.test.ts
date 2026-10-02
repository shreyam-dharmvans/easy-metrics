import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/prisma.js';
import { ensureDefaultProject } from '../src/services/seed.js';

describe('Domain: Analytics, Aggregations & Trace Waterfall', () => {
  const sampleTraceId = '11223344556677889900aabbccddeeff';
  const rootSpanId = '1122334455667788';
  const dbSpanId = '9988776655443322';
  let activeProjectId: string;

  beforeAll(async () => {
    await ensureDefaultProject();
    const project = await prisma.project.findFirst({
      orderBy: { createdAt: 'asc' },
    });
    activeProjectId = project!.id;

    const now = new Date();
    const startTime = new Date(now.getTime() - 5000);
    const endTime = now;

    // Seed a sample trace with a root server span and child DB span
    await prisma.trace.upsert({
      where: { id: sampleTraceId },
      create: {
        id: sampleTraceId,
        projectId: activeProjectId,
        serviceName: 'metrics-test-service',
        rootRoute: 'GET /api/v1/users',
        httpMethod: 'GET',
        statusCode: 200,
        durationMs: 120.5,
        hasError: false,
        timestamp: startTime,
      },
      update: {},
    });

    await prisma.span.createMany({
      data: [
        {
          id: rootSpanId,
          traceId: sampleTraceId,
          projectId: activeProjectId,
          name: 'GET /api/v1/users',
          kind: 'SERVER',
          httpMethod: 'GET',
          httpUrl: '/api/v1/users',
          statusCode: 200,
          durationMs: 120.5,
          startTime,
          endTime,
          hasError: false,
        },
        {
          id: dbSpanId,
          traceId: sampleTraceId,
          projectId: activeProjectId,
          parentSpanId: rootSpanId,
          name: 'SELECT users',
          kind: 'CLIENT',
          durationMs: 45.0,
          startTime: new Date(startTime.getTime() + 10),
          endTime: new Date(startTime.getTime() + 55),
          hasError: false,
        },
      ],
      skipDuplicates: true,
    });
  });

  afterAll(async () => {
    await prisma.span.deleteMany({ where: { traceId: sampleTraceId } });
    await prisma.trace.deleteMany({ where: { id: sampleTraceId } });
    await prisma.$disconnect();
  });

  it('GET /api/v1/metrics/overview returns calculated KPI stats', async () => {
    const res = await request(app)
      .get('/api/v1/metrics/overview')
      .query({ timeframe: '24h', projectId: activeProjectId });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('totalRequests');
    expect(res.body).toHaveProperty('avgLatencyMs');
    expect(res.body).toHaveProperty('p95LatencyMs');
    expect(res.body).toHaveProperty('errorRatePercent');
    expect(res.body).toHaveProperty('statusBreakdown');
    expect(res.body).toHaveProperty('timeSeries');
    expect(Array.isArray(res.body.timeSeries)).toBe(true);
  });

  it('GET /api/v1/metrics/routes returns endpoint breakdown', async () => {
    const res = await request(app)
      .get('/api/v1/metrics/routes')
      .query({ timeframe: '24h', projectId: activeProjectId });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const foundRoute = res.body.find((r: any) => r.route === 'GET /api/v1/users');
    expect(foundRoute).toBeDefined();
    expect(foundRoute.totalCalls).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/v1/metrics/traces returns paginated trace summaries', async () => {
    const res = await request(app)
      .get('/api/v1/metrics/traces')
      .query({ timeframe: '24h', limit: 10, projectId: activeProjectId });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('total');
    expect(res.body).toHaveProperty('page', 1);
    expect(res.body).toHaveProperty('limit', 10);
    expect(Array.isArray(res.body.traces)).toBe(true);

    const traceItem = res.body.traces.find((t: any) => t.id === sampleTraceId);
    expect(traceItem).toBeDefined();
    expect(traceItem.rootRoute).toBe('GET /api/v1/users');
  });

  it('GET /api/v1/metrics/traces/:traceId returns full waterfall span hierarchy', async () => {
    const res = await request(app)
      .get(`/api/v1/metrics/traces/${sampleTraceId}`)
      .query({ projectId: activeProjectId });

    expect(res.status).toBe(200);
    expect(res.body.trace.id).toBe(sampleTraceId);
    expect(res.body.spans).toBeDefined();
    expect(res.body.spans.length).toBe(2);

    // Verify waterfall timing calculation
    const rootSpan = res.body.spans.find((s: any) => s.id === rootSpanId);
    const childSpan = res.body.spans.find((s: any) => s.id === dbSpanId);

    expect(rootSpan.offsetMs).toBe(0);
    expect(childSpan.parentSpanId).toBe(rootSpanId);
    expect(childSpan.offsetMs).toBeGreaterThanOrEqual(0);
  });

  it('GET /api/v1/metrics/traces/:traceId returns 404 for nonexistent trace', async () => {
    const res = await request(app)
      .get('/api/v1/metrics/traces/nonexistent_trace_id_99999')
      .query({ projectId: activeProjectId });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Trace not found');
  });
});
