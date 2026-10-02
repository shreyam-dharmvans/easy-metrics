import { Request, Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';

// Schema for a single OpenTelemetry Span sent by our SDK
const SpanInputSchema = z.object({
  id: z.string(), // 16-char hex span_id
  traceId: z.string(), // 32-char hex trace_id
  parentSpanId: z.string().nullable().optional(),
  name: z.string(),
  kind: z.enum(['SERVER', 'CLIENT', 'INTERNAL']).default('INTERNAL'),
  httpMethod: z.string().nullable().optional(),
  httpUrl: z.string().nullable().optional(),
  statusCode: z.number().nullable().optional(),
  durationMs: z.number().nonnegative(),
  startTime: z.string().datetime(), // ISO 8601 string
  endTime: z.string().datetime(),
  hasError: z.boolean().default(false),
  errorMessage: z.string().nullable().optional(),
  errorStack: z.string().nullable().optional(),
  attributes: z.record(z.any()).optional(),
});

// Schema for the entire batch payload
const IngestPayloadSchema = z.object({
  serviceName: z.string().default('node-service'),
  spans: z.array(SpanInputSchema).min(1, 'Payload must contain at least 1 span'),
});

export type IngestPayload = z.infer<typeof IngestPayloadSchema>;

/**
 * High-Throughput Ingestion Controller:
 * POST /api/v1/telemetry/ingest
 */
export async function ingestTelemetry(req: Request, res: Response) {
  const projectId = req.project?.id;
  if (!projectId) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Project context missing' });
  }

  // 1. Validate payload against Zod schema
  const parseResult = IngestPayloadSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: 'Invalid Payload',
      details: parseResult.error.flatten(),
    });
  }

  const { serviceName, spans } = parseResult.data;

  try {
    // 2. Group spans by traceId to identify root requests
    const traceMap = new Map<string, typeof spans>();
    for (const span of spans) {
      const existing = traceMap.get(span.traceId) || [];
      existing.push(span);
      traceMap.set(span.traceId, existing);
    }

    // 3. Prepare Trace records and Span records
    const tracesToUpsert: Prisma.TraceUncheckedCreateInput[] = [];
    const spansToInsert: Prisma.SpanCreateManyInput[] = [];

    for (const [traceId, traceSpans] of traceMap.entries()) {
      // The root span is the SERVER span (incoming HTTP request) or span without parent
      const rootSpan = traceSpans.find((s) => s.kind === 'SERVER' || !s.parentSpanId) || traceSpans[0];

      const anyErrorInTrace = traceSpans.some((s) => s.hasError || (s.statusCode && s.statusCode >= 500));
      const totalDuration = rootSpan.durationMs;

      const attrs = (rootSpan.attributes || {}) as Record<string, unknown>;
      const rawRoute =
        (attrs['http.route'] as string) ||
        (attrs['http.target'] as string) ||
        (attrs['url.path'] as string) ||
        rootSpan.httpUrl ||
        rootSpan.name;

      const method = rootSpan.httpMethod || 'GET';
      const formattedRoute = rawRoute.startsWith(method) ? rawRoute : `${method} ${rawRoute}`;

      tracesToUpsert.push({
        id: traceId,
        projectId,
        serviceName,
        rootRoute: formattedRoute,
        httpMethod: method,
        statusCode: rootSpan.statusCode || 200,
        durationMs: totalDuration,
        hasError: anyErrorInTrace,
        timestamp: new Date(rootSpan.startTime),
      });

      for (const s of traceSpans) {
        spansToInsert.push({
          id: s.id,
          traceId: s.traceId,
          projectId,
          parentSpanId: s.parentSpanId ?? null,
          name: s.name,
          kind: s.kind,
          httpMethod: s.httpMethod ?? null,
          httpUrl: s.httpUrl ?? null,
          statusCode: s.statusCode ?? null,
          durationMs: s.durationMs,
          startTime: new Date(s.startTime),
          endTime: new Date(s.endTime),
          hasError: s.hasError,
          errorMessage: s.errorMessage ?? null,
          errorStack: s.errorStack ?? null,
          attributes: s.attributes ? s.attributes : undefined,
        });
      }
    }

    // 4. Atomic execution: upsert Traces, then bulk-insert Spans
    await prisma.$transaction(async (tx) => {
      // Upsert traces (if a trace was already partially recorded by a previous batch, update it)
      for (const t of tracesToUpsert) {
        await tx.trace.upsert({
          where: { id: t.id },
          create: t,
          update: {
            durationMs: t.durationMs,
            statusCode: t.statusCode,
            hasError: t.hasError,
          },
        });
      }

      // Bulk insert all child spans in 1 single SQL statement
      await tx.span.createMany({
        data: spansToInsert,
        skipDuplicates: true, // Idempotent: avoid crashing if SDK retries a batch
      });
    });

    return res.status(202).json({
      success: true,
      ingested: {
        tracesCount: tracesToUpsert.length,
        spansCount: spansToInsert.length,
      },
    });
  } catch (error) {
    console.error('Error ingesting telemetry batch:', error);
    return res.status(500).json({ error: 'Internal server error ingesting telemetry' });
  }
}

