import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import dotenv from 'dotenv';
import { EasyMetricsConfig } from './types.js';
import { EasyMetricsSpanExporter } from './exporter.js';

export * from './types.js';
export { EasyMetricsSpanExporter };

let sdkInstance: NodeSDK | null = null;

/**
 * Initializes EasyMetrics zero-config APM observability
 */
export function init(config?: EasyMetricsConfig): void {
  // Prevent double initialization
  if (sdkInstance) {
    if (config?.debug) {
      console.warn('[EasyMetrics] SDK is already initialized');
    }
    return;
  }

  // Automatically load .env if not yet loaded (solves ESM import hoisting)
  if (!process.env.EASY_METRICS_API_KEY && !config?.apiKey) {
    dotenv.config();
  }

  const apiKey = config?.apiKey || process.env.EASY_METRICS_API_KEY;
  const endpoint =
    config?.endpoint ||
    process.env.EASY_METRICS_ENDPOINT ||
    'http://localhost:4000/api/v1/telemetry/ingest';
  const serviceName =
    config?.serviceName ||
    process.env.SERVICE_NAME ||
    process.env.npm_package_name ||
    'node-service';
  const debug = config?.debug ?? process.env.EASY_METRICS_DEBUG === 'true';

  if (!apiKey) {
    console.warn(
      '⚠️ [EasyMetrics] No API key provided. Set EASY_METRICS_API_KEY in your .env or pass { apiKey: "..." } to init(). Telemetry is inactive.'
    );
    return;
  }

  if (debug) {
    console.log(`[EasyMetrics] Initializing for service "${serviceName}" -> ${endpoint}`);
  }

  // 1. Create custom exporter with our batch and auth settings
  const exporter = new EasyMetricsSpanExporter({
    endpoint,
    apiKey,
    serviceName,
    debug,
  });

  // 2. Configure NodeSDK with auto-instrumentations and our custom traceExporter
  sdkInstance = new NodeSDK({
    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]: serviceName,
    }),
    traceExporter: exporter,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable noisy low-level fs / dns instrumentation to keep telemetry focused on network calls
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-dns': { enabled: false },
        '@opentelemetry/instrumentation-net': { enabled: false },
        // Ensure HTTP, HTTPS, Express, and Fetch are active
        '@opentelemetry/instrumentation-http': { enabled: true },
        '@opentelemetry/instrumentation-express': { enabled: true },
      }),
    ],
  });

  // Start OpenTelemetry instrumentation
  try {
    sdkInstance.start();
    if (debug) {
      console.log('✅ [EasyMetrics] Observability SDK started successfully.');
    }
  } catch (err) {
    console.error('❌ [EasyMetrics] Failed to start observability SDK:', err);
  }

  // Graceful shutdown: flush in-flight spans when the server is stopped
  const gracefulShutdown = async () => {
    if (sdkInstance) {
      if (debug) console.log('[EasyMetrics] Flushing final spans before exit...');
      await sdkInstance.shutdown().catch(() => { });
      process.exit(0);
    }
  };

  process.once('SIGTERM', gracefulShutdown);
  process.once('SIGINT', gracefulShutdown);
}

