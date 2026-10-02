import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma.js';
import { autoAlignDemoTraces } from '../services/demoSync.js';

// Helper to parse timeframe or custom start/end into Date objects
function parseTimeWindow(req: Request): { since: Date; until: Date } {
  const now = new Date();
  const startDateStr = req.query.startDate as string | undefined;
  const endDateStr = req.query.endDate as string | undefined;

  if (startDateStr) {
    const start = new Date(startDateStr);
    const end = endDateStr ? new Date(endDateStr) : now;
    if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
      return { since: start, until: end };
    }
  }

  const timeframe = (req.query.timeframe as string) || '1h';
  const nowMs = now.getTime();
  let sinceMs: number;

  switch (timeframe) {
    case '15m':
      sinceMs = nowMs - 15 * 60 * 1000;
      break;
    case '1h':
      sinceMs = nowMs - 60 * 60 * 1000;
      break;
    case '24h':
      sinceMs = nowMs - 24 * 60 * 60 * 1000;
      break;
    case '7d':
      sinceMs = nowMs - 7 * 24 * 60 * 60 * 1000;
      break;
    default:
      sinceMs = nowMs - 60 * 60 * 1000;
  }

  return { since: new Date(sinceMs), until: now };
}

/**
 * GET /api/v1/metrics/overview
 * Returns summary KPIs, speed buckets, latency trends, and traffic breakdown
 */
export async function getOverviewMetrics(req: Request, res: Response) {
  const projectId = req.project?.id;
  if (!projectId) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Project context missing' });
  }

  if ((req as any).isDemo) {
    await autoAlignDemoTraces();
  }

  const { since, until } = parseTimeWindow(req);
  const route = (req.query.route as string | undefined)?.trim();
  const fastThreshold = Math.max(1, parseInt((req.query.fast as string) || '150', 10));
  const slowThreshold = Math.max(fastThreshold + 1, parseInt((req.query.slow as string) || '500', 10));

  const routeSql = route ? Prisma.sql`AND "rootRoute" = ${route}` : Prisma.empty;

  try {
    const totalRequests = await prisma.trace.count({
      where: {
        projectId,
        timestamp: { gte: since, lte: until },
        ...(route ? { rootRoute: route } : {}),
      },
    });

    if (totalRequests === 0) {
      return res.json({
        totalRequests: 0,
        requestsPerMinute: 0,
        avgLatencyMs: 0,
        p50LatencyMs: 0,
        p95LatencyMs: 0,
        p99LatencyMs: 0,
        peakLatencyMs: 0,
        errorRatePercent: 0,
        fastRequestsCount: 0,
        moderateRequestsCount: 0,
        slowRequestsCount: 0,
        slowRequestsPercent: 0,
        statusBreakdown: { ok: 0, clientError: 0, serverError: 0 },
        thresholds: { fast: fastThreshold, slow: slowThreshold },
        timeSeries: [],
      });
    }

    const errorRequests = await prisma.trace.count({
      where: {
        projectId,
        timestamp: { gte: since, lte: until },
        hasError: true,
        ...(route ? { rootRoute: route } : {}),
      },
    });

    // Compute Summary Stats in single PostgreSQL query
    const stats = await prisma.$queryRaw<
      Array<{
        avg_latency: number | null;
        p50_latency: number | null;
        p95_latency: number | null;
        p99_latency: number | null;
        peak_latency: number | null;
        fast_count: bigint | null;
        moderate_count: bigint | null;
        slow_count: bigint | null;
        ok_count: bigint | null;
        client_err_count: bigint | null;
        server_err_count: bigint | null;
      }>
    >`
      SELECT
        AVG("durationMs")::FLOAT AS avg_latency,
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY "durationMs")::FLOAT AS p50_latency,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "durationMs")::FLOAT AS p95_latency,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY "durationMs")::FLOAT AS p99_latency,
        MAX("durationMs")::FLOAT AS peak_latency,
        COUNT(*) FILTER (WHERE "durationMs" < ${fastThreshold})::BIGINT AS fast_count,
        COUNT(*) FILTER (WHERE "durationMs" >= ${fastThreshold} AND "durationMs" <= ${slowThreshold})::BIGINT AS moderate_count,
        COUNT(*) FILTER (WHERE "durationMs" > ${slowThreshold})::BIGINT AS slow_count,
        COUNT(*) FILTER (WHERE "statusCode" >= 200 AND "statusCode" < 300)::BIGINT AS ok_count,
        COUNT(*) FILTER (WHERE "statusCode" >= 400 AND "statusCode" < 500)::BIGINT AS client_err_count,
        COUNT(*) FILTER (WHERE "statusCode" >= 500)::BIGINT AS server_err_count
      FROM traces
      WHERE "projectId" = ${projectId} AND timestamp >= ${since} AND timestamp <= ${until} ${routeSql}
    `;

    const summary = stats[0] || {
      avg_latency: 0,
      p50_latency: 0,
      p95_latency: 0,
      p99_latency: 0,
      peak_latency: 0,
      fast_count: 0n,
      moderate_count: 0n,
      slow_count: 0n,
      ok_count: 0n,
      client_err_count: 0n,
      server_err_count: 0n,
    };

    // Dynamic Interval Bucketing for Time Series
    const durationMs = until.getTime() - since.getTime();
    let truncInterval = 'minute';
    if (durationMs > 3 * 24 * 60 * 60 * 1000) {
      truncInterval = 'hour'; // > 3 days -> bucket by hour
    }

    const timeSeries = await prisma.$queryRaw<
      Array<{
        bucket: string;
        request_count: bigint;
        avg_latency: number;
        peak_latency: number;
        error_count: bigint;
        ok_count: bigint;
        client_err_count: bigint;
        server_err_count: bigint;
        fast_count: bigint;
        moderate_count: bigint;
        slow_count: bigint;
      }>
    >`
      SELECT
        date_trunc(${truncInterval}, timestamp) AS bucket,
        COUNT(*)::BIGINT AS request_count,
        AVG("durationMs")::FLOAT AS avg_latency,
        MAX("durationMs")::FLOAT AS peak_latency,
        COUNT(*) FILTER (WHERE "hasError" = true)::BIGINT AS error_count,
        COUNT(*) FILTER (WHERE "statusCode" >= 200 AND "statusCode" < 300)::BIGINT AS ok_count,
        COUNT(*) FILTER (WHERE "statusCode" >= 400 AND "statusCode" < 500)::BIGINT AS client_err_count,
        COUNT(*) FILTER (WHERE "statusCode" >= 500)::BIGINT AS server_err_count,
        COUNT(*) FILTER (WHERE "durationMs" < ${fastThreshold})::BIGINT AS fast_count,
        COUNT(*) FILTER (WHERE "durationMs" >= ${fastThreshold} AND "durationMs" <= ${slowThreshold})::BIGINT AS moderate_count,
        COUNT(*) FILTER (WHERE "durationMs" > ${slowThreshold})::BIGINT AS slow_count
      FROM traces
      WHERE "projectId" = ${projectId} AND timestamp >= ${since} AND timestamp <= ${until} ${routeSql}
      GROUP BY bucket
      ORDER BY bucket ASC
    `;

    const minutesElapsed = Math.max(1, (until.getTime() - since.getTime()) / (60 * 1000));
    const requestsPerMinute = Number((totalRequests / minutesElapsed).toFixed(2));
    const errorRatePercent = Number(((errorRequests / totalRequests) * 100).toFixed(2));
    const slowCount = Number(summary.slow_count || 0);
    const slowRequestsPercent = totalRequests > 0 ? Number(((slowCount / totalRequests) * 100).toFixed(1)) : 0;

    return res.json({
      totalRequests,
      requestsPerMinute,
      avgLatencyMs: Math.round((summary.avg_latency || 0) * 10) / 10,
      p50LatencyMs: Math.round((summary.p50_latency || 0) * 10) / 10,
      p95LatencyMs: Math.round((summary.p95_latency || 0) * 10) / 10,
      p99LatencyMs: Math.round((summary.p99_latency || 0) * 10) / 10,
      peakLatencyMs: Math.round((summary.peak_latency || 0) * 10) / 10,
      errorRatePercent,
      fastRequestsCount: Number(summary.fast_count || 0),
      moderateRequestsCount: Number(summary.moderate_count || 0),
      slowRequestsCount: slowCount,
      slowRequestsPercent,
      statusBreakdown: {
        ok: Number(summary.ok_count || 0),
        clientError: Number(summary.client_err_count || 0),
        serverError: Number(summary.server_err_count || 0),
      },
      thresholds: {
        fast: fastThreshold,
        slow: slowThreshold,
      },
      timeSeries: timeSeries.map((t) => ({
        timestamp: t.bucket,
        requests: Number(t.request_count),
        avgLatencyMs: Math.round(t.avg_latency || 0),
        peakLatencyMs: Math.round(t.peak_latency || 0),
        errors: Number(t.error_count),
        ok: Number(t.ok_count),
        clientErrors: Number(t.client_err_count),
        serverErrors: Number(t.server_err_count),
        fast: Number(t.fast_count),
        moderate: Number(t.moderate_count),
        slow: Number(t.slow_count),
      })),
    });
  } catch (error) {
    console.error('Error in getOverviewMetrics:', error);
    return res.status(500).json({ error: 'Failed to compute overview metrics' });
  }
}

/**
 * GET /api/v1/metrics/routes
 * Returns endpoint-by-endpoint breakdown ranked by traffic or latency
 */
export async function getRouteMetrics(req: Request, res: Response) {
  const projectId = req.project?.id;
  if (!projectId) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Project context missing' });
  }

  const { since, until } = parseTimeWindow(req);

  try {
    const routes = await prisma.$queryRaw<
      Array<{
        root_route: string;
        http_method: string;
        total_calls: bigint;
        avg_latency: number;
        p95_latency: number;
        error_count: bigint;
      }>
    >`
      SELECT
        "rootRoute" AS root_route,
        "httpMethod" AS http_method,
        COUNT(*)::BIGINT AS total_calls,
        AVG("durationMs")::FLOAT AS avg_latency,
        PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY "durationMs")::FLOAT AS p95_latency,
        COUNT(*) FILTER (WHERE "hasError" = true)::BIGINT AS error_count
      FROM traces
      WHERE "projectId" = ${projectId} AND timestamp >= ${since} AND timestamp <= ${until}
      GROUP BY "rootRoute", "httpMethod"
      ORDER BY p95_latency DESC
    `;

    return res.json(
      routes.map((r) => {
        const total = Number(r.total_calls);
        const errors = Number(r.error_count);
        return {
          route: r.root_route,
          method: r.http_method,
          totalCalls: total,
          avgLatencyMs: Math.round((r.avg_latency || 0) * 10) / 10,
          p95LatencyMs: Math.round((r.p95_latency || 0) * 10) / 10,
          errorRatePercent: total > 0 ? Number(((errors / total) * 100).toFixed(1)) : 0,
        };
      })
    );
  } catch (error) {
    console.error('Error in getRouteMetrics:', error);
    return res.status(500).json({ error: 'Failed to fetch route metrics' });
  }
}

/**
 * GET /api/v1/metrics/traces
 * Returns paginated list of traces with micro span breakdown
 */
export async function getTraces(req: Request, res: Response) {
  const projectId = req.project?.id;
  if (!projectId) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Project context missing' });
  }

  const route = (req.query.route as string | undefined)?.trim();
  const status = req.query.status as string | undefined;
  const minDurationMs = req.query.minDurationMs ? parseFloat(req.query.minDurationMs as string) : undefined;
  const onlyErrors = req.query.errors === 'true' || status === '5xx';
  const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
  const skip = (page - 1) * limit;

  let statusCodeFilter: { gte?: number; lt?: number } | undefined = undefined;
  if (status === '2xx') {
    statusCodeFilter = { gte: 200, lt: 300 };
  } else if (status === '4xx') {
    statusCodeFilter = { gte: 400, lt: 500 };
  } else if (status === '5xx') {
    statusCodeFilter = { gte: 500 };
  }

  const { since, until } = parseTimeWindow(req);

  const where = {
    projectId,
    timestamp: { gte: since, lte: until },
    ...(route ? { rootRoute: { contains: route, mode: 'insensitive' as const } } : {}),
    ...(onlyErrors ? { hasError: true } : {}),
    ...(statusCodeFilter ? { statusCode: statusCodeFilter } : {}),
    ...(minDurationMs !== undefined ? { durationMs: { gte: minDurationMs } } : {}),
  };

  try {
    const [total, traces] = await Promise.all([
      prisma.trace.count({ where }),
      prisma.trace.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: limit,
        include: {
          _count: {
            select: { spans: true },
          },
          spans: {
            select: {
              name: true,
              durationMs: true,
              kind: true,
              hasError: true,
            },
            orderBy: { durationMs: 'desc' },
            take: 3,
          },
        },
      }),
    ]);

    return res.json({
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      traces: traces.map((t) => ({
        id: t.id,
        traceId: t.id,
        route: t.rootRoute,
        rootRoute: t.rootRoute,
        method: t.httpMethod,
        httpMethod: t.httpMethod,
        statusCode: t.statusCode,
        durationMs: t.durationMs,
        hasError: t.hasError,
        spanCount: t._count.spans,
        topSpans: t.spans.map((s) => ({
          name: s.name,
          durationMs: s.durationMs,
          kind: s.kind,
          hasError: s.hasError,
        })),
        timestamp: t.timestamp,
      })),
    });
  } catch (error) {
    console.error('Error in getTraces:', error);
    return res.status(500).json({ error: 'Failed to fetch traces' });
  }
}

/**
 * GET /api/v1/metrics/traces/:traceId
 * Returns the full Trace detail and ordered Spans for Waterfall visualizer
 */
export async function getTraceWaterfall(req: Request, res: Response) {
  const projectId = req.project?.id;
  const { traceId } = req.params;

  if (!projectId || !traceId) {
    return res.status(400).json({ error: 'Missing projectId or traceId' });
  }

  try {
    const trace = await prisma.trace.findUnique({
      where: { id: traceId },
      include: {
        spans: {
          orderBy: { startTime: 'asc' },
        },
      },
    });

    if (!trace || trace.projectId !== projectId) {
      return res.status(404).json({ error: 'Trace not found' });
    }

    const traceStartMs = new Date(trace.timestamp).getTime();

    // Calculate relative offset and waterfall metrics for each span
    const spansWithOffset = trace.spans.map((span) => {
      const spanStartMs = new Date(span.startTime).getTime();
      const relativeOffsetMs = Math.max(0, spanStartMs - traceStartMs);

      return {
        id: span.id,
        traceId: span.traceId,
        parentSpanId: span.parentSpanId,
        name: span.name,
        kind: span.kind,
        httpMethod: span.httpMethod,
        httpUrl: span.httpUrl,
        statusCode: span.statusCode,
        durationMs: span.durationMs,
        offsetMs: relativeOffsetMs,
        startTime: span.startTime,
        endTime: span.endTime,
        hasError: span.hasError,
        errorMessage: span.errorMessage,
        errorStack: span.errorStack,
        attributes: span.attributes,
      };
    });

    return res.json({
      trace: {
        id: trace.id,
        serviceName: trace.serviceName,
        route: trace.rootRoute,
        method: trace.httpMethod,
        statusCode: trace.statusCode,
        durationMs: trace.durationMs,
        hasError: trace.hasError,
        timestamp: trace.timestamp,
      },
      spans: spansWithOffset,
    });
  } catch (error) {
    console.error('Error in getTraceWaterfall:', error);
    return res.status(500).json({ error: 'Failed to fetch trace waterfall' });
  }
}

