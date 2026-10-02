export interface ThresholdConfig {
  fastMs: number;            // Default: 150ms
  slowMs: number;            // Default: 500ms
  bottleneckPercent: number; // Default: 40%
}

export interface Span {
  id: string;
  traceId: string;
  parentSpanId?: string | null;
  name: string;
  kind: string;
  startTime: string;
  endTime: string;
  durationMs: number;
  statusCode: number;
  hasError: boolean;
  httpMethod?: string | null;
  httpUrl?: string | null;
  errorMessage?: string | null;
  errorStack?: string | null;
  attributes?: Record<string, any>;
}

export interface TopSpan {
  name: string;
  durationMs: number;
  kind: string;
  hasError?: boolean;
}

export interface Trace {
  id: string;
  traceId?: string;
  route?: string;
  rootRoute?: string;
  method?: string;
  httpMethod?: string;
  statusCode: number;
  durationMs: number;
  hasError: boolean;
  timestamp: string;
  spanCount?: number;
  topSpans?: TopSpan[];
  spans?: Span[];
}

export interface TimeSeriesPoint {
  timestamp: string;
  requests: number;
  avgLatencyMs: number;
  peakLatencyMs: number;
  errors: number;
  ok: number;
  clientErrors: number;
  serverErrors: number;
  fast: number;
  moderate: number;
  slow: number;
}

export interface OverviewMetrics {
  totalRequests: number;
  requestsPerMinute: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  peakLatencyMs: number;
  errorRatePercent: number;
  fastRequestsCount: number;
  moderateRequestsCount: number;
  slowRequestsCount: number;
  slowRequestsPercent: number;
  statusBreakdown: {
    ok: number;
    clientError: number;
    serverError: number;
  };
  thresholds: {
    fast: number;
    slow: number;
  };
  timeSeries: TimeSeriesPoint[];
}

export interface RouteMetric {
  route: string;
  method: string;
  totalCalls: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  errorRatePercent: number;
}

