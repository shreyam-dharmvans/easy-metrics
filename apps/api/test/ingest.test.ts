import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { prisma } from '../src/prisma.js';
import { ensureDefaultProject } from '../src/services/seed.js';

describe('Domain: Telemetry Ingestion & Security Bouncer', () => {
  let demoApiKey = 'em_live_local_dev_key';

  beforeAll(async () => {
    await ensureDefaultProject();
    const keyRecord = await prisma.apiKey.findFirst({
      where: { key: demoApiKey },
    });
    if (keyRecord) {
      demoApiKey = keyRecord.key;
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects requests missing the x-api-key header with 401 Unauthorized', async () => {
    const res = await request(app)
      .post('/api/v1/telemetry/ingest')
      .send({ serviceName: 'test-service', spans: [] });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
    expect(res.body.message).toContain("Missing 'x-api-key' header");
  });

  it('rejects requests with an invalid x-api-key with 403 Forbidden', async () => {
    const res = await request(app)
      .post('/api/v1/telemetry/ingest')
      .set('x-api-key', 'invalid-key-random-string')
      .send({ serviceName: 'test-service', spans: [] });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toContain('Invalid EasyMetrics API key');
  });

  it('rejects requests with valid key but invalid schema with 400 Bad Request', async () => {
    const res = await request(app)
      .post('/api/v1/telemetry/ingest')
      .set('x-api-key', demoApiKey)
      .send({
        serviceName: 'test-service',
        spans: [], // Zod schema enforces at least 1 span!
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid Payload');
    expect(res.body.details).toBeDefined();
  });

  it('successfully accepts and ingests valid spans with 202 Accepted', async () => {
    const testTraceId = 'aabbccdd11223344556677889900aabb';
    const testSpanId = '1122334455667788';
    const now = new Date().toISOString();

    const validPayload = {
      serviceName: 'ingest-test-service',
      spans: [
        {
          id: testSpanId,
          traceId: testTraceId,
          name: 'GET /api/test-ingest',
          kind: 'SERVER',
          httpMethod: 'GET',
          httpUrl: '/api/test-ingest',
          statusCode: 200,
          durationMs: 38.5,
          startTime: now,
          endTime: now,
          hasError: false,
          attributes: {
            'http.route': '/api/test-ingest',
            'http.status_code': 200,
          },
        },
      ],
    };

    const res = await request(app)
      .post('/api/v1/telemetry/ingest')
      .set('x-api-key', demoApiKey)
      .send(validPayload);

    expect(res.status).toBe(202);
    expect(res.body.success).toBe(true);
    expect(res.body.ingested).toBeDefined();
    expect(res.body.ingested.tracesCount).toBe(1);
    expect(res.body.ingested.spansCount).toBe(1);

    // Verify trace is queryable in PostgreSQL
    const insertedTrace = await prisma.trace.findUnique({
      where: { id: testTraceId },
    });
    expect(insertedTrace).not.toBeNull();
    expect(insertedTrace?.rootRoute).toBe('GET /api/test-ingest');

    // Cleanup
    await prisma.span.deleteMany({ where: { traceId: testTraceId } });
    await prisma.trace.delete({ where: { id: testTraceId } });
  });
});
