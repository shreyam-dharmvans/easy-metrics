import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExportResultCode, HrTime } from '@opentelemetry/core';
import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { ReadableSpan } from '@opentelemetry/sdk-trace-base';
import { EasyMetricsSpanExporter } from '../src/exporter.js';

/**
 * Helper to build a lightweight mock ReadableSpan
 */
function createMockSpan(overrides: Partial<ReadableSpan> = {}): ReadableSpan {
  const defaultSpan: Partial<ReadableSpan> = {
    name: 'GET /api/test',
    kind: SpanKind.SERVER,
    parentSpanId: undefined,
    spanContext: () => ({
      traceId: '4bf92f3577b34da6a3ce929d0e0e4736',
      spanId: '00f067aa0ba902b7',
      traceFlags: 1,
    }),
    startTime: [1727650000, 0] as HrTime,
    endTime: [1727650000, 50_000_000] as HrTime,
    duration: [0, 50_000_000] as HrTime, // 50 milliseconds
    attributes: {
      'http.method': 'GET',
      'http.status_code': 200,
    },
    status: {
      code: SpanStatusCode.OK,
    },
    links: [],
    events: [],
    resource: {
      attributes: {},
      merge: () => null as any,
    } as any,
    instrumentationLibrary: { name: 'test' },
  };

  return {
    ...defaultSpan,
    ...overrides,
    spanContext: overrides.spanContext || defaultSpan.spanContext!,
  } as ReadableSpan;
}

describe('EasyMetricsSpanExporter', () => {
  let exporter: EasyMetricsSpanExporter;

  beforeEach(() => {
    exporter = new EasyMetricsSpanExporter({
      endpoint: 'http://localhost:4000/api/v1/telemetry/ingest',
      apiKey: 'em_live_test_key_123',
      serviceName: 'test-service',
      debug: false,
    });
  });

  // ============================================================================
  // TEST 1: EMPTY BATCH SAFETY
  // ============================================================================
  it('should return SUCCESS immediately when given an empty spans array', () => {
    return new Promise<void>((resolve) => {
      exporter.export([], (result) => {
        expect(result.code).toBe(ExportResultCode.SUCCESS);
        resolve();
      });
    });
  });

  // ============================================================================
  // TEST 2: SHUTDOWN DEFENSE
  // ============================================================================
  it('should return FAILED when attempting to export after shutdown', async () => {
    await exporter.shutdown();

    const mockSpan = createMockSpan({ name: 'GET /test' });

    return new Promise<void>((resolve) => {
      exporter.export([mockSpan], (result) => {
        expect(result.code).toBe(ExportResultCode.FAILED);
        expect(result.error?.message).toBe('Exporter is shut down');
        resolve();
      });
    });
  });

  // ============================================================================
  // TEST 3: DATA TRANSFORMATION & NANOSECOND TIME MATH
  // ============================================================================
  it('should accurately transform OpenTelemetry spans into EasyMetrics schema', async () => {
    // Mock the private sendPayload method so no real network requests are fired
    const sendSpy = vi.spyOn(exporter as any, 'sendPayload').mockResolvedValue(true);

    const mockSpan = createMockSpan({
      name: 'GET /api/products',
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': 'GET',
        'http.target': '/api/products',
        'http.status_code': 200,
      },
      duration: [0, 50_000_000], // 50,000,000 nanoseconds = 50ms
    });

    await new Promise<void>((resolve) => {
      exporter.export([mockSpan], (result) => {
        expect(result.code).toBe(ExportResultCode.SUCCESS);
        resolve();
      });
    });

    expect(sendSpy).toHaveBeenCalledOnce();
    const formatted = sendSpy.mock.calls[0][0][0]; // First call, first arg (spans array), first item

    expect(formatted.id).toBe('00f067aa0ba902b7');
    expect(formatted.traceId).toBe('4bf92f3577b34da6a3ce929d0e0e4736');
    expect(formatted.name).toBe('GET /api/products');
    expect(formatted.kind).toBe('SERVER');
    expect(formatted.httpMethod).toBe('GET');
    expect(formatted.statusCode).toBe(200);
    expect(formatted.durationMs).toBe(50);
    expect(formatted.hasError).toBe(false);
  });

  // ============================================================================
  // TEST 4: ERROR DETECTION (500 Status -> hasError: true)
  // ============================================================================
  it('should detect 500 status code and mark hasError as true', async () => {
    const sendSpy = vi.spyOn(exporter as any, 'sendPayload').mockResolvedValue(true);

    const mockSpan = createMockSpan({
      name: 'POST /api/checkout',
      kind: SpanKind.SERVER,
      attributes: {
        'http.method': 'POST',
        'http.status_code': 500,
      },
      status: {
        code: SpanStatusCode.ERROR,
        message: 'Internal Server Error',
      },
      duration: [0, 120_000_000], // 120ms
    });

    await new Promise<void>((resolve) => {
      exporter.export([mockSpan], () => resolve());
    });

    const formatted = sendSpy.mock.calls[0][0][0];
    expect(formatted.hasError).toBe(true);
    expect(formatted.statusCode).toBe(500);
    expect(formatted.durationMs).toBe(120);
  });
});
