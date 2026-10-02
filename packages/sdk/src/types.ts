/**
 * Configuration options for the EasyMetrics SDK
 */
export interface EasyMetricsConfig {
  /**
   * Project API key from EasyMetrics dashboard.
   * Defaults to process.env.EASY_METRICS_API_KEY
   */
  apiKey?: string;

  /**
   * Ingestion endpoint URL.
   * Defaults to process.env.EASY_METRICS_ENDPOINT or 'http://localhost:4000/api/v1/telemetry/ingest'
   */
  endpoint?: string;

  /**
   * Name of this microservice / application (e.g. 'checkout-service').
   * Defaults to process.env.SERVICE_NAME or npm_package_name or 'node-service'
   */
  serviceName?: string;

  /**
   * Interval in milliseconds at which buffered spans are exported in the background.
   * Default: 2000 ms (2 seconds)
   */
  flushIntervalMs?: number;

  /**
   * Maximum number of spans allowed in memory before dropping oldest.
   * Protects the host application against memory leaks if backend is unreachable.
   * Default: 2048
   */
  maxQueueSize?: number;

  /**
   * Enable verbose console logging for debugging the SDK during development.
   * Default: false
   */
  debug?: boolean;
}

/**
 * Clean Span data structure formatted for EasyMetrics backend ingestion
 */
export interface EasyMetricsSpanPayload {
  id: string;
  traceId: string;
  parentSpanId?: string | null;
  name: string;
  kind: 'SERVER' | 'CLIENT' | 'INTERNAL';
  httpMethod?: string | null;
  httpUrl?: string | null;
  statusCode?: number | null;
  durationMs: number;
  startTime: string; // ISO 8601 UTC
  endTime: string;   // ISO 8601 UTC
  hasError: boolean;
  errorMessage?: string | null;
  errorStack?: string | null;
  attributes?: Record<string, unknown>;
}

