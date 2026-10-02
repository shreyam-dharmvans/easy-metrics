import { ExportResult, ExportResultCode, hrTimeToMilliseconds, hrTimeToTimeStamp } from '@opentelemetry/core';
import { ReadableSpan, SpanExporter } from '@opentelemetry/sdk-trace-base';
import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { EasyMetricsSpanPayload } from './types.js';

/**
 * Custom OpenTelemetry SpanExporter:
 * Transforms raw OpenTelemetry spans into EasyMetrics clean payload
 * and posts them asynchronously to the ingestion backend.
 */
export class EasyMetricsSpanExporter implements SpanExporter {
  private endpoint: string;
  private apiKey: string;
  private serviceName: string;
  private debug: boolean;
  private isShutdown = false;

  constructor(options: {
    endpoint: string;
    apiKey: string;
    serviceName: string;
    debug?: boolean;
  }) {
    this.endpoint = options.endpoint;
    this.apiKey = options.apiKey;
    this.serviceName = options.serviceName;
    this.debug = options.debug || false;
  }

  /**
   * Called automatically by OpenTelemetry's BatchSpanProcessor
   */
  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    if (this.isShutdown) {
      resultCallback({ code: ExportResultCode.FAILED, error: new Error('Exporter is shut down') });
      return;
    }

    if (!spans || spans.length === 0) {
      resultCallback({ code: ExportResultCode.SUCCESS });
      return;
    }

    // Transform OpenTelemetry ReadableSpan objects into EasyMetrics schema
    const formattedSpans: EasyMetricsSpanPayload[] = spans.map((span) => {
      const spanContext = span.spanContext();
      const attributes = span.attributes;

      // Extract HTTP details from OpenTelemetry semantic attributes
      const httpMethod =
        (attributes['http.method'] as string) ||
        (attributes['http.request.method'] as string) ||
        null;

      const httpUrl =
        (attributes['http.url'] as string) ||
        (attributes['http.target'] as string) ||
        (attributes['url.full'] as string) ||
        null;

      const statusCode =
        Number(
          attributes['http.status_code'] ||
          attributes['http.response.status_code']
        ) || null;

      // Map OpenTelemetry SpanKind
      let kind: 'SERVER' | 'CLIENT' | 'INTERNAL' = 'INTERNAL';
      if (span.kind === SpanKind.SERVER) kind = 'SERVER';
      else if (span.kind === SpanKind.CLIENT) kind = 'CLIENT';

      // Accurate time calculation from nanoseconds HrTime tuple
      const durationMs = Math.round(hrTimeToMilliseconds(span.duration) * 100) / 100;
      const startIso = new Date(hrTimeToTimeStamp(span.startTime)).toISOString();
      const endIso = new Date(hrTimeToTimeStamp(span.endTime)).toISOString();

      const hasError =
        span.status.code === SpanStatusCode.ERROR ||
        (statusCode !== null && statusCode >= 500);

      return {
        id: spanContext.spanId,
        traceId: spanContext.traceId,
        parentSpanId: span.parentSpanId || null,
        name: span.name,
        kind,
        httpMethod,
        httpUrl,
        statusCode,
        durationMs,
        startTime: startIso,
        endTime: endIso,
        hasError,
        errorMessage: span.status.message || null,
        attributes: Object.keys(attributes).length > 0 ? (attributes as Record<string, unknown>) : undefined,
      };
    });

    // Send asynchronously over HTTP (Non-blocking)
    this.sendPayload(formattedSpans)
      .then(() => {
        if (this.debug) {
          console.log(`[EasyMetrics SDK] Successfully flushed ${formattedSpans.length} spans`);
        }
        resultCallback({ code: ExportResultCode.SUCCESS });
      })
      .catch((err) => {
        if (this.debug) {
          console.warn('[EasyMetrics SDK] Failed to export telemetry batch:', err.message);
        }
        // Always report failure gracefully without crashing the host application
        resultCallback({ code: ExportResultCode.FAILED, error: err });
      });
  }

  private async sendPayload(spans: EasyMetricsSpanPayload[]): Promise<void> {
    const payload = {
      serviceName: this.serviceName,
      spans,
    };

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`Ingestion endpoint returned HTTP ${response.status}: ${errorText}`);
    }
  }

  async shutdown(): Promise<void> {
    this.isShutdown = true;
  }
}

