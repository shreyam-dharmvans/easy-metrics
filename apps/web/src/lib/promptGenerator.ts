import { Trace, Span, ThresholdConfig, RouteMetric, OverviewMetrics } from '../types';

/**
 * Builds an ASCII execution tree showing parent -> child span hierarchy with timings.
 */
function buildAsciiCallTree(spans: Span[], rootDurationMs: number): string {
  if (!spans || spans.length === 0) return 'No spans recorded.';

  // Build parent -> children map
  const childMap = new Map<string, Span[]>();
  const rootSpans: Span[] = [];

  // Index spans by ID
  const spanById = new Map<string, Span>();
  for (const s of spans) {
    spanById.set(s.id, s);
  }

  for (const s of spans) {
    if (!s.parentSpanId || !spanById.has(s.parentSpanId)) {
      rootSpans.push(s);
    } else {
      const existing = childMap.get(s.parentSpanId) || [];
      existing.push(s);
      childMap.set(s.parentSpanId, existing);
    }
  }

  const lines: string[] = [];

  function printNode(span: Span, prefix: string, isTail: boolean) {
    const pct = rootDurationMs > 0 ? Math.round((span.durationMs / rootDurationMs) * 100) : 0;
    const connector = isTail ? '└── ' : '├── ';
    const statusIcon = span.hasError || span.statusCode >= 400 ? '🚨' : span.durationMs >= 500 ? '⚠️' : '✓';
    lines.push(`${prefix}${connector}[${statusIcon} ${span.kind}] ${span.name} (${span.durationMs}ms, ${pct}%)`);

    const children = childMap.get(span.id) || [];
    // Sort children chronologically
    children.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      const childIsTail = i === children.length - 1;
      const childPrefix = prefix + (isTail ? '    ' : '│   ');
      printNode(child, childPrefix, childIsTail);
    }
  }

  // Sort root spans
  rootSpans.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  for (let i = 0; i < rootSpans.length; i++) {
    printNode(rootSpans[i], '', i === rootSpans.length - 1);
  }

  return lines.join('\n');
}

/**
 * Generates a complete, high-fidelity prompt containing ALL telemetry data
 * (all spans, parentSpanId, kind, timestamps, duration, full attributes, and raw error stacks)
 * structured for AI IDEs like Cursor, GitHub Copilot, Gemini, and Claude.
 */
export function generateTraceCursorPrompt(
  trace: Trace,
  spans: Span[],
  thresholds: ThresholdConfig = { fastMs: 150, slowMs: 500, bottleneckPercent: 40 }
): string {
  const totalMs = Math.max(trace.durationMs, 1);
  const routeName = trace.route || trace.rootRoute || 'Unknown Route';
  const method = trace.method || trace.httpMethod || 'GET';
  const statusCode = trace.statusCode || (trace.hasError ? 500 : 200);

  // 1. Sort spans chronologically
  const sortedSpans = [...spans].sort((a, b) => {
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  });

  const traceStartTime = trace.timestamp ? new Date(trace.timestamp).getTime() : (sortedSpans[0] ? new Date(sortedSpans[0].startTime).getTime() : Date.now());

  // 2. Enrich spans with offset and bottleneck status
  const enrichedSpans = sortedSpans.map((span) => {
    const isRoot = !span.parentSpanId || span.kind === 'SERVER' || span.name === routeName;
    const spanStart = new Date(span.startTime).getTime();
    const offsetMs = Math.max(0, spanStart - traceStartTime);
    const pctOfTotal = Math.min(100, Math.round((span.durationMs / totalMs) * 100));
    const isBottleneck = !isRoot && (pctOfTotal >= thresholds.bottleneckPercent || span.durationMs >= thresholds.slowMs);

    return {
      id: span.id,
      parentSpanId: span.parentSpanId || null,
      name: span.name,
      kind: span.kind,
      startTime: span.startTime,
      endTime: span.endTime,
      durationMs: span.durationMs,
      offsetMs,
      percentOfTotalTrace: pctOfTotal,
      statusCode: span.statusCode || 200,
      hasError: span.hasError || span.statusCode >= 400,
      errorMessage: span.errorMessage || null,
      errorStack: span.errorStack || null,
      isBottleneck,
      attributes: span.attributes || {},
    };
  });

  // 3. Find primary and all bottleneck spans
  const bottlenecks = enrichedSpans.filter((s) => s.isBottleneck);
  bottlenecks.sort((a, b) => b.durationMs - a.durationMs);
  const primaryBottleneck = bottlenecks[0] || null;

  // 4. Detect consecutive sequential database queries (N+1 / sequential await anti-patterns)
  const sequentialDbWarnings: Array<{
    firstSpan: { id: string; name: string; durationMs: number };
    secondSpan: { id: string; name: string; durationMs: number };
    combinedMs: number;
  }> = [];

  for (let i = 0; i < sortedSpans.length - 1; i++) {
    const curr = sortedSpans[i];
    const next = sortedSpans[i + 1];
    const isCurrDb = curr.name.toLowerCase().includes('prisma') || curr.name.toLowerCase().includes('select') || curr.attributes?.['db.system'] || curr.attributes?.['db.statement'];
    const isNextDb = next.name.toLowerCase().includes('prisma') || next.name.toLowerCase().includes('select') || next.attributes?.['db.system'] || next.attributes?.['db.statement'];

    if (isCurrDb && isNextDb) {
      const currEnd = new Date(curr.endTime).getTime();
      const nextStart = new Date(next.startTime).getTime();
      if (nextStart >= currEnd - 5) {
        sequentialDbWarnings.push({
          firstSpan: { id: curr.id, name: curr.name, durationMs: curr.durationMs },
          secondSpan: { id: next.id, name: next.name, durationMs: next.durationMs },
          combinedMs: curr.durationMs + next.durationMs,
        });
      }
    }
  }

  // 5. Build call tree
  const callTree = buildAsciiCallTree(sortedSpans, totalMs);

  // 6. Complete structured telemetry payload
  const fullTelemetryPayload = {
    apm: 'EasyMetrics APM',
    trace: {
      id: trace.id,
      route: routeName,
      httpMethod: method,
      statusCode,
      durationMs: trace.durationMs,
      startTime: trace.timestamp,
      hasError: trace.hasError,
      spanCount: sortedSpans.length,
      thresholds: {
        fastMs: thresholds.fastMs,
        slowMs: thresholds.slowMs,
        bottleneckPercent: thresholds.bottleneckPercent,
      },
    },
    bottlenecks: bottlenecks.map((b) => ({
      spanId: b.id,
      name: b.name,
      durationMs: b.durationMs,
      percentOfTotal: b.percentOfTotalTrace,
      attributes: b.attributes,
      errorMessage: b.errorMessage,
    })),
    sequentialDbWarnings,
    spans: enrichedSpans,
  };

  // 7. Refactoring recommendations
  const recommendations: string[] = [];
  if (primaryBottleneck) {
    recommendations.push(
      `Primary Bottleneck (${primaryBottleneck.percentOfTotalTrace}% of total request): Span "${primaryBottleneck.name}" (ID: ${primaryBottleneck.id}) took ${primaryBottleneck.durationMs}ms. Check for missing database indexes, un-cached queries, or slow network I/O.`
    );
  }
  if (sequentialDbWarnings.length > 0) {
    recommendations.push(
      `Sequential Await / N+1 Anti-Pattern: Found ${sequentialDbWarnings.length} consecutive database query sequence(s). Consider combining them into a single JOIN/batch query or parallelizing with Promise.all().`
    );
  }
  const failedSpan = enrichedSpans.find((s) => s.hasError || s.errorMessage);
  if (failedSpan) {
    recommendations.push(
      `Unhandled Exception in Span "${failedSpan.name}": "${failedSpan.errorMessage || 'Unknown error'}". Inspect the stack trace below and implement proper error handling or data validation.`
    );
  }
  if (recommendations.length === 0) {
    recommendations.push('Review span durations and look for redundant calculations or serial awaits.');
  }

  return `You are an expert software engineer optimizing this repository. Use the full production telemetry below captured by EasyMetrics APM to diagnose and improve the codebase.

## 🎯 Task & Goal
1. Locate the route handler and service functions handling \`${method} ${routeName}\` in this codebase.
2. Investigate the identified bottlenecks and any failing spans.
3. Propose and implement concrete code optimizations (e.g. database indexing, query batching via Promise.all, Redis caching, or error handling).

---

## 📊 Complete Runtime Telemetry (EasyMetrics APM)
\`\`\`json
${JSON.stringify(fullTelemetryPayload, null, 2)}
\`\`\`

---

## 🌳 Span Execution Hierarchy Tree
\`\`\`text
${callTree}
\`\`\`

---

## 🔍 Diagnostics & Key Findings
- **Total Duration**: ${trace.durationMs}ms (Threshold: Slow >${thresholds.slowMs}ms)
- **Status**: ${statusCode} ${trace.hasError ? '🚨 (Server Error)' : '✓ (OK)'}
- **Primary Bottleneck**: ${primaryBottleneck ? `"${primaryBottleneck.name}" taking ${primaryBottleneck.durationMs}ms (${primaryBottleneck.percentOfTotalTrace}% of total trace)` : 'None detected above threshold'}
${sequentialDbWarnings.length > 0 ? `- **Sequential DB Calls**: ${sequentialDbWarnings.length} sequential query pair(s) detected.` : ''}

## 🛠️ Recommended Action Items for this Repository
${recommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}
`;
}

/**
 * Generates an aggregate route-level performance prompt containing full telemetry
 * for Cursor, GitHub Copilot, Gemini, and Claude.
 */
export function generateRouteCursorPrompt(
  route: RouteMetric,
  timeframe: string = '7d',
  thresholds: ThresholdConfig = { fastMs: 150, slowMs: 500, bottleneckPercent: 40 },
  overview?: OverviewMetrics | null
): string {
  const isSlow = route.p95LatencyMs > thresholds.slowMs;
  const hasErrors = route.errorRatePercent > 0;
  const healthStatus = hasErrors && route.errorRatePercent > 5 ? 'CRITICAL' : isSlow ? 'DEGRADED' : 'HEALTHY';

  const fullRoutePayload = {
    apm: 'EasyMetrics APM',
    type: 'route_performance_summary',
    route: {
      endpoint: route.route,
      httpMethod: route.method,
      timeframe,
      healthStatus,
      traffic: {
        totalRequests: route.totalCalls,
        throughputRpm: overview ? overview.requestsPerMinute : undefined,
      },
      latency: {
        avgLatencyMs: route.avgLatencyMs,
        p50LatencyMs: overview ? overview.p50LatencyMs : undefined,
        p95LatencyMs: route.p95LatencyMs,
        p99LatencyMs: overview ? overview.p99LatencyMs : undefined,
        peakLatencyMs: overview ? overview.peakLatencyMs : undefined,
        isP95Degraded: isSlow,
      },
      errors: {
        errorRatePercent: route.errorRatePercent,
        statusBreakdown: overview ? overview.statusBreakdown : undefined,
      },
      thresholds: {
        fastMs: thresholds.fastMs,
        slowMs: thresholds.slowMs,
        bottleneckPercent: thresholds.bottleneckPercent,
      },
    },
  };

  return `You are an expert software engineer optimizing this repository. Use the route telemetry below captured by EasyMetrics APM to audit and optimize this endpoint.

## 🎯 Task & Goal
1. Locate the route handler, middleware, and database models handling \`${route.method} ${route.route}\` in this codebase.
2. Review the performance characteristics (P95 latency: ${route.p95LatencyMs}ms, Error rate: ${route.errorRatePercent}%).
3. Implement targeted optimizations to bring P95 latency under ${thresholds.slowMs}ms and eliminate any runtime errors.

---

## 📊 Route Telemetry Payload (EasyMetrics APM)
\`\`\`json
${JSON.stringify(fullRoutePayload, null, 2)}
\`\`\`

---

## 🔍 Route Health Observations
- **Endpoint**: \`${route.method} ${route.route}\`
- **Timeframe**: Last ${timeframe}
- **Volume**: ${route.totalCalls} total requests
- **P95 Latency**: ${route.p95LatencyMs}ms ${isSlow ? `⚠️ (Exceeds ${thresholds.slowMs}ms slow threshold)` : '✓ (Acceptable)'}
- **Average Latency**: ${route.avgLatencyMs}ms
- **Error Rate**: ${route.errorRatePercent}% ${hasErrors ? '🚨 (Failing requests detected)' : '✓ (0% errors)'}

## 🛠️ Recommended Action Items for this Repository
1. Find all controller/handler files matching route \`${route.route}\`.
2. Inspect database queries executed by this route; add missing indexes or batch queries.
3. Verify error handling, input validation, and HTTP status codes returned by the handler.
4. If this route performs heavy reads, implement HTTP or Redis caching.
`;
}
