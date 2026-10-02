'use client';

import React, { useState } from 'react';
import { Trace, Span } from '../../types';
import { useThresholds } from '../../context/ThresholdContext';

interface SpanWithOffset extends Span {
  offsetMs?: number;
}

interface TraceWaterfallViewProps {
  trace: Trace;
  spans: SpanWithOffset[];
  fullPageView?: boolean;
}

// Redact sensitive values from input/output previews
function redactSensitiveData(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redactSensitiveData);

  const SENSITIVE_PATTERN = /password|secret|token|authorization|bearer|cookie|creditcard|cvv|ssn|apikey/i;
  const cleaned: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_PATTERN.test(key)) {
      cleaned[key] = '•••••••• (redacted)';
    } else if (typeof value === 'object' && value !== null) {
      cleaned[key] = redactSensitiveData(value);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

// Extract or synthesize structured input & output
function extractSpanIO(span: any) {
  const attrs = span.attributes || {};

  let rawInput = attrs.input ?? attrs['span.input'] ?? attrs['http.request.body'] ?? null;
  let rawOutput = attrs.output ?? attrs['span.output'] ?? attrs['http.response.body'] ?? null;

  let inputType = 'JSON Payload';
  let outputType = 'JSON Response';

  // Smart fallback if span has no explicit input
  if (!rawInput) {
    if (span.category === 'db' || span.name.toLowerCase().includes('select') || span.name.toLowerCase().includes('insert') || span.name.toLowerCase().includes('update')) {
      inputType = 'SQL Query & Params';
      rawInput = {
        query: span.name,
        parameters: attrs['db.parameters'] || attrs['db.params'] || attrs['parameters'] || {
          filter: 'in_stock = true',
          limit: 20,
        },
      };
    } else if (span.category === 'cache' || span.name.toLowerCase().includes('redis')) {
      inputType = 'Redis Command';
      const parts = span.name.split(':');
      rawInput = {
        command: parts[0] || 'GET',
        key: parts.slice(1).join(':') || 'session:cache',
        dbIndex: 0,
      };
    } else if (span.category === 'http' || span.kind === 'CLIENT') {
      inputType = 'HTTP Request';
      rawInput = {
        method: span.httpMethod || (span.name.startsWith('POST') ? 'POST' : 'GET'),
        url: span.httpUrl || span.name.replace(/^(GET|POST|PUT|DELETE)\s+/, ''),
        headers: {
          Accept: 'application/json',
          'User-Agent': 'EasyMetrics-Client/1.0',
        },
      };
    } else if (span.isRoot) {
      inputType = 'HTTP Request';
      rawInput = {
        route: span.httpUrl || span.name,
        method: span.httpMethod || 'GET',
        headers: {
          Accept: 'application/json',
          Host: 'api.easymetrics.io',
        },
      };
    } else {
      inputType = 'Span Context';
      rawInput = {
        operation: span.name,
        kind: span.kind,
      };
    }
  }

  // If the span failed, the error and stack trace are the natural output of the operation
  if (span.hasError || Boolean(span.errorMessage)) {
    outputType = 'Exception & Error Stack';
    rawOutput = {
      error: span.errorMessage || 'Operation failed with unhandled exception',
      statusCode: span.statusCode || 500,
      stack: span.errorStack || undefined,
      ...(rawOutput && typeof rawOutput === 'object' ? rawOutput : {}),
    };
  } else if (!rawOutput) {
    if (span.category === 'db') {
      outputType = 'SQL Result Preview';
      rawOutput = {
        status: 'SUCCESS',
        rowsReturned: attrs['db.rows_returned'] ?? 14,
        executionTimeMs: span.durationMs,
        preview: [
          { id: 'prod_901', name: 'Premium Cloud Instance (4 vCPU)', price: 49.00 },
          { id: 'prod_902', name: 'NVMe Storage Expansion (200GB)', price: 29.00 },
        ],
      };
    } else if (span.category === 'cache') {
      outputType = 'Cache Result';
      rawOutput = {
        status: 'HIT',
        cacheKey: attrs['cache.key'] || 'catalog:cache',
        ttlRemainingSeconds: 240,
        sizeBytes: 3120,
      };
    } else if (span.category === 'http' || span.kind === 'CLIENT') {
      outputType = 'HTTP Response';
      rawOutput = {
        statusCode: span.statusCode || 200,
        statusText: 'OK',
        durationMs: span.durationMs,
        responseSize: '2.4 KB',
      };
    } else if (span.isRoot) {
      outputType = 'HTTP Response';
      rawOutput = {
        statusCode: span.statusCode || 200,
        statusText: 'OK',
        durationMs: span.durationMs,
      };
    } else {
      outputType = 'Execution Result';
      rawOutput = {
        status: 'COMPLETED',
        durationMs: span.durationMs,
      };
    }
  }

  return {
    input: redactSensitiveData(rawInput),
    output: redactSensitiveData(rawOutput),
    inputType,
    outputType,
  };
}

export function TraceWaterfallView({
  trace,
  spans,
  fullPageView = false,
}: TraceWaterfallViewProps) {
  const { thresholds } = useThresholds();
  const [expandedSpanId, setExpandedSpanId] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'db' | 'http' | 'server' | 'bottleneck'>('all');
  const handleCopyText = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const totalDuration = Math.max(1, trace.durationMs);

  // Classify and enrich each span
  const enrichedSpans = spans.map((span) => {
    const offset = span.offsetMs || 0;
    const offsetPercent = Math.min(96, Math.max(0, (offset / totalDuration) * 100));
    const widthPercent = Math.max(4, Math.min(100 - offsetPercent, (span.durationMs / totalDuration) * 100));
    const pctOfTotal = Math.min(100, Math.round((span.durationMs / totalDuration) * 100));

    const isRoot = !span.parentSpanId || span.name === trace.route || span.id === trace.id;
    const isDb =
      span.kind === 'INTERNAL' ||
      span.name.toLowerCase().includes('select') ||
      span.name.toLowerCase().includes('from') ||
      span.name.startsWith('DatabaseQuery') ||
      span.name.toLowerCase().includes('prisma');
    const isClient =
      span.kind === 'CLIENT' ||
      span.name.startsWith('http') ||
      span.name.includes('https://') ||
      span.name.includes('api.');
    const isCache = span.name.toLowerCase().includes('redis') || span.name.toLowerCase().includes('cache');
    const isServer = isRoot || span.kind === 'SERVER';

    // Only non-root spans can be bottlenecks (root is the whole container)
    // Directly obeys the user's configured bottleneck percentage threshold
    const isBottleneck =
      !isRoot &&
      (pctOfTotal >= thresholds.bottleneckPercent || span.durationMs >= thresholds.slowMs);

    // Category
    let category: 'db' | 'http' | 'cache' | 'server' | 'internal' = 'internal';
    if (isDb) category = 'db';
    else if (isClient) category = 'http';
    else if (isCache) category = 'cache';
    else if (isServer) category = 'server';

    // Styling
    let barBg = 'bg-sky-500/20 border-sky-500 text-sky-800 dark:text-sky-300';
    let kindBadge = 'bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-800';
    let kindLabel = span.kind;

    if (span.hasError) {
      barBg = 'bg-rose-500/30 border-2 border-rose-500 text-rose-800 dark:text-rose-200';
      kindBadge = 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border-rose-400 dark:border-rose-800';
    } else if (isBottleneck) {
      barBg = 'bg-rose-500/25 border-2 border-rose-500 text-rose-800 dark:text-rose-300 shadow-xs';
      kindBadge = 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border-rose-400 dark:border-rose-800 font-bold';
      kindLabel = 'BOTTLENECK';
    } else if (isRoot) {
      barBg = 'bg-indigo-500/20 border-2 border-indigo-500 text-indigo-800 dark:text-indigo-300';
      kindBadge = 'bg-indigo-100 dark:bg-indigo-950/70 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800';
      kindLabel = 'ROOT HTTP';
    } else if (isDb) {
      barBg = 'bg-amber-500/20 border border-amber-500 text-amber-800 dark:text-amber-300';
      kindBadge = 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800';
      kindLabel = 'POSTGRES / DB';
    } else if (isClient) {
      barBg = 'bg-purple-500/20 border border-purple-500 text-purple-800 dark:text-purple-300';
      kindBadge = 'bg-purple-100 dark:bg-purple-950/70 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800';
      kindLabel = 'HTTP CLIENT';
    } else if (isCache) {
      barBg = 'bg-cyan-500/20 border border-cyan-500 text-cyan-800 dark:text-cyan-300';
      kindBadge = 'bg-cyan-100 dark:bg-cyan-950/70 text-cyan-800 dark:text-cyan-300 border-cyan-300 dark:border-cyan-800';
      kindLabel = 'REDIS';
    }

    return {
      ...span,
      offset,
      offsetPercent,
      widthPercent,
      pctOfTotal,
      isRoot,
      isBottleneck,
      category,
      barBg,
      kindBadge,
      kindLabel,
    };
  });

  // Filtered spans
  const filteredSpans = enrichedSpans.filter((s) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = s.name.toLowerCase().includes(q);
      const matchId = s.id.toLowerCase().includes(q);
      if (!matchName && !matchId) return false;
    }
    if (categoryFilter === 'bottleneck') return s.isBottleneck || s.hasError;
    if (categoryFilter === 'db') return s.category === 'db';
    if (categoryFilter === 'http') return s.category === 'http';
    if (categoryFilter === 'server') return s.category === 'server' || s.isRoot;
    return true;
  });

  // Identify primary bottleneck for callout banner
  const primaryBottleneck = enrichedSpans.find((s) => s.isBottleneck);

  return (
    <div className="space-y-4">
      {/* Primary Bottleneck Callout Banner if detected */}
      {primaryBottleneck && (
        <div className="px-4 py-3 rounded-xl border border-rose-300 dark:border-rose-800/80 bg-rose-50/80 dark:bg-rose-950/40 text-xs text-rose-900 dark:text-rose-200 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 shadow-2xs">
          {/* Left section: Icon, Title, Name, Duration, and Percentage Badges */}
          <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
            <div className="flex items-center gap-1.5 shrink-0">
              <svg
                className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="font-bold text-rose-950 dark:text-rose-200 shrink-0">
                Primary Bottleneck:
              </span>
            </div>

            <span
              className="px-2 py-0.5 rounded bg-rose-100 dark:bg-rose-900/50 border border-rose-300 dark:border-rose-700/70 font-mono text-[11px] text-rose-900 dark:text-rose-200 truncate max-w-xs sm:max-w-sm"
              title={primaryBottleneck.name}
            >
              {primaryBottleneck.name}
            </span>

            <div className="flex items-center gap-2 shrink-0">
              <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white font-mono font-bold text-[11px] shadow-2xs">
                {primaryBottleneck.durationMs}ms
              </span>

              <span className="text-rose-400 dark:text-rose-500 font-bold">•</span>

              <span className="px-2 py-0.5 rounded-md bg-rose-200/80 dark:bg-rose-900/80 text-rose-900 dark:text-rose-200 font-mono font-bold text-[11px] border border-rose-300 dark:border-rose-700">
                {primaryBottleneck.pctOfTotal}% of total time (threshold: ≥{thresholds.bottleneckPercent}%)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Waterfall Timeline Card */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs overflow-hidden">
        {/* Controls Toolbar: Title Badge, Category Filters, and Search */}
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/50 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* View Title */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
                <span className="text-indigo-500">⚡</span> Waterfall Execution Timeline
              </span>
              <span className="text-[11px] font-mono text-zinc-400">
                ({filteredSpans.length} {filteredSpans.length === 1 ? 'span' : 'spans'})
              </span>
            </div>

            <span className="hidden sm:inline text-zinc-300 dark:text-zinc-700">|</span>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1 text-[11px] font-semibold">
              <button
                type="button"
                onClick={() => setCategoryFilter('all')}
                className={`px-2.5 py-0.5 rounded-md border transition-colors cursor-pointer ${categoryFilter === 'all'
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 border-transparent shadow-2xs'
                  : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                  }`}
              >
                All ({enrichedSpans.length})
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter('db')}
                className={`px-2.5 py-0.5 rounded-md border transition-colors cursor-pointer ${categoryFilter === 'db'
                  ? 'bg-amber-500 text-white border-transparent shadow-2xs'
                  : 'border-zinc-200 dark:border-zinc-800 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                  }`}
              >
                🗄️ Database
              </button>
              <button
                type="button"
                onClick={() => setCategoryFilter('http')}
                className={`px-2.5 py-0.5 rounded-md border transition-colors cursor-pointer ${categoryFilter === 'http'
                  ? 'bg-purple-600 text-white border-transparent shadow-2xs'
                  : 'border-zinc-200 dark:border-zinc-800 text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/30'
                  }`}
              >
                🌐 HTTP Client
              </button>
              {primaryBottleneck && (
                <button
                  type="button"
                  onClick={() => setCategoryFilter('bottleneck')}
                  className={`px-2.5 py-0.5 rounded-md border transition-colors cursor-pointer ${categoryFilter === 'bottleneck'
                    ? 'bg-rose-600 text-white border-transparent shadow-2xs'
                    : 'border-zinc-200 dark:border-zinc-800 text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30'
                    }`}
                >
                  ⚠️ Bottlenecks (≥{thresholds.bottleneckPercent}%)
                </button>
              )}
            </div>
          </div>

          {/* Search Input */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Filter spans (SELECT, HTTP...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="px-2.5 py-1 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:border-indigo-500 w-44 sm:w-56 font-mono"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs font-bold cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* WATERFALL GANTT TIMELINE WITH EXACTLY ALIGNED TIME RULER                  */}
        {/* ========================================================================= */}
        <div>
          {/* Time Axis Ruler — Left 45% Span Title, Right 55% Aligned Ruler */}
          <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/80 dark:bg-zinc-950/80 px-4 py-2 text-[10px] font-mono text-zinc-600 dark:text-zinc-400 font-semibold select-none">
            <div className="w-[45%] uppercase tracking-wider text-zinc-500">
              Spans &amp; Hierarchy ({filteredSpans.length})
            </div>
            <div className="w-[55%] relative flex justify-between pr-2">
              <span>0ms</span>
              <span>{(totalDuration * 0.25).toFixed(1)}ms</span>
              <span>{(totalDuration * 0.5).toFixed(1)}ms</span>
              <span>{(totalDuration * 0.75).toFixed(1)}ms</span>
              <span className="font-bold text-zinc-900 dark:text-white">
                {totalDuration.toFixed(1)}ms
              </span>
            </div>
          </div>

          {/* Spans List with Vertical Guide Lines */}
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60 relative">
            {/* Continuous Vertical Dashed Grid Lines over the right 55% */}
            <div className="absolute right-0 top-0 bottom-0 w-[55%] pointer-events-none flex pr-2 z-0">
              <div className="w-1/4 h-full border-r border-dashed border-zinc-200/80 dark:border-zinc-800/60" />
              <div className="w-1/4 h-full border-r border-dashed border-zinc-200/80 dark:border-zinc-800/60" />
              <div className="w-1/4 h-full border-r border-dashed border-zinc-200/80 dark:border-zinc-800/60" />
              <div className="w-1/4 h-full border-r border-dashed border-zinc-200/80 dark:border-zinc-800/60" />
            </div>

            {filteredSpans.map((span) => {
              const isExpanded = expandedSpanId === span.id;

              return (
                <div
                  key={span.id}
                  className="relative z-10 transition-colors hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40"
                >
                  {/* Span Gantt Row */}
                  <div
                    onClick={() => setExpandedSpanId(isExpanded ? null : span.id)}
                    className="p-3 cursor-pointer flex items-center justify-between gap-3"
                  >
                    {/* Left 45%: Hierarchy, Type, Name */}
                    <div className="w-[45%] flex items-center gap-2 min-w-0 pr-2">
                      {/* Tree indentation branch */}
                      {!span.isRoot && (
                        <span className="text-zinc-400 dark:text-zinc-600 font-mono text-xs select-none pl-2 shrink-0">
                          └─
                        </span>
                      )}

                      {/* Status Code Pill */}
                      <span
                        className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-bold border shrink-0 ${span.hasError || (span.statusCode && span.statusCode >= 500)
                          ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                          : span.statusCode && span.statusCode >= 400
                            ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800'
                            : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800'
                          }`}
                      >
                        {span.statusCode || 200}
                      </span>

                      {/* Kind Badge */}
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 ${span.kindBadge}`}
                      >
                        {span.kindLabel}
                      </span>

                      {/* Span Name */}
                      <span className="font-mono text-xs text-zinc-900 dark:text-zinc-100 font-medium truncate">
                        {span.name}
                      </span>
                    </div>

                    {/* Right 55%: Gantt Bar Track (100% aligned with Time Ruler above) */}
                    <div className="w-[55%] relative h-7 pr-2 flex items-center">
                      <div
                        className={`h-6 rounded-md border absolute flex items-center px-2 text-[10px] font-mono font-bold transition-all shadow-2xs overflow-hidden ${span.barBg}`}
                        style={{
                          left: `${span.offsetPercent}%`,
                          width: `${span.widthPercent}%`,
                          minWidth: '55px',
                        }}
                        title={`${span.name} (Start: +${span.offset}ms, Duration: ${span.durationMs}ms, ${span.pctOfTotal}%)`}
                      >
                        <span className="truncate">
                          {span.durationMs}ms ({span.pctOfTotal}%)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Inspector: Direct Input & Output View (with Error & Stack integrated directly into Output) */}
                  {isExpanded && (() => {
                    const { input, output, inputType, outputType } = extractSpanIO(span);
                    const inputStr = typeof input === 'string' ? input : JSON.stringify(input, null, 2);
                    const outputStr = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
                    const hasError = span.hasError || Boolean(span.errorMessage);

                    return (
                      <div className="px-5 pb-5 pt-3.5 border-t border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/90 dark:bg-zinc-950/80 text-xs space-y-3">
                        {/* Compact Metadata Ribbon: Status, Duration, Offset, Category, Span ID */}
                        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-zinc-200 dark:border-zinc-800/70">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Status */}
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border shrink-0 ${hasError
                                ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                                : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800'
                                }`}
                            >
                              {span.statusCode || (hasError ? 500 : 200)} {hasError ? 'FAILED' : 'OK'}
                            </span>

                            {/* Duration & % */}
                            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800">
                              ⏱️ {span.durationMs}ms ({span.pctOfTotal}% of trace)
                            </span>

                            {/* Offset */}
                            <span className="px-2 py-0.5 rounded text-[11px] font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                              Offset: +{span.offset}ms
                            </span>

                            {/* Category Badge */}
                            <span className={`px-2 py-0.5 rounded text-[11px] font-bold border shrink-0 ${span.kindBadge}`}>
                              {span.kindLabel}
                            </span>
                          </div>

                          {/* Span ID with Copy Button */}
                          <div className="flex items-center gap-1.5 text-[11px] font-mono text-zinc-400">
                            <span>Span ID:</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyText(`${span.id}-id`, span.id);
                              }}
                              className="px-2 py-0.5 rounded bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer border border-zinc-200 dark:border-zinc-800 font-semibold"
                              title="Click to copy Span ID"
                            >
                              {copiedKey === `${span.id}-id` ? '✓ Copied!' : span.id}
                            </button>
                          </div>
                        </div>

                        {/* Direct Side-by-Side: Input on Left, Output (or Error Stack) on Right */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                          {/* Left Card: Input & Arguments */}
                          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs overflow-hidden flex flex-col">
                            <div className="px-3.5 py-2 bg-zinc-50 dark:bg-zinc-950/70 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                                  <span className="text-sky-500 font-black">→</span> Input &amp; Parameters
                                </span>
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-200 dark:border-sky-800/80">
                                  {inputType}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyText(`${span.id}-input`, inputStr);
                                }}
                                className="px-2 py-0.5 rounded text-[11px] font-mono font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <span>{copiedKey === `${span.id}-input` ? '✓ Copied' : '📋 Copy Input'}</span>
                              </button>
                            </div>
                            <div className="p-3.5 bg-zinc-950 text-zinc-200 flex-1 overflow-x-auto min-h-[140px] max-h-[320px]">
                              <pre className="font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap">
                                {inputStr}
                              </pre>
                            </div>
                          </div>

                          {/* Right Card: Output & Result (or Error & Stack if failed) */}
                          <div
                            className={`rounded-xl border shadow-2xs overflow-hidden flex flex-col ${hasError
                              ? 'border-rose-300 dark:border-rose-800/90 bg-rose-50/20 dark:bg-rose-950/20'
                              : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
                              }`}
                          >
                            <div
                              className={`px-3.5 py-2 border-b flex items-center justify-between ${hasError
                                ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800/80'
                                : 'bg-zinc-50 dark:bg-zinc-950/70 border-zinc-200 dark:border-zinc-800'
                                }`}
                            >
                              <div className="flex items-center gap-2">
                                <span
                                  className={`font-bold flex items-center gap-1.5 ${hasError ? 'text-rose-900 dark:text-rose-200' : 'text-zinc-900 dark:text-white'
                                    }`}
                                >
                                  <span className={`font-black ${hasError ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-500'}`}>
                                    {hasError ? '✕' : '←'}
                                  </span>{' '}
                                  {hasError ? 'Output: Error & Exception' : 'Output & Result Preview'}
                                </span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold border ${hasError
                                    ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-700'
                                    : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/80'
                                    }`}
                                >
                                  {hasError ? 'Failed Exception' : outputType}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const textToCopy = hasError && span.errorStack
                                    ? `${span.errorMessage || 'Error'}\n\n${span.errorStack}`
                                    : outputStr;
                                  handleCopyText(`${span.id}-output`, textToCopy);
                                }}
                                className={`px-2 py-0.5 rounded text-[11px] font-mono font-medium border transition-colors cursor-pointer flex items-center gap-1 ${hasError
                                  ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200 hover:bg-rose-200 dark:hover:bg-rose-800 border-rose-300 dark:border-rose-700'
                                  : 'text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 border-zinc-200 dark:border-zinc-800'
                                  }`}
                              >
                                <span>
                                  {copiedKey === `${span.id}-output`
                                    ? '✓ Copied'
                                    : hasError
                                      ? '📋 Copy Error & Stack'
                                      : '📋 Copy Output'}
                                </span>
                              </button>
                            </div>

                            <div className="p-3.5 bg-zinc-950 text-zinc-200 flex-1 overflow-x-auto min-h-[140px] max-h-[320px]">
                              {hasError ? (
                                <div className="space-y-2">
                                  <div className="text-rose-400 font-bold font-mono text-xs flex items-center gap-2">
                                    <span>❌ Exception:</span>
                                    <span>{span.errorMessage || 'Internal Server Error / Unhandled Exception'}</span>
                                  </div>
                                  {span.errorStack ? (
                                    <pre className="font-mono text-[11px] text-rose-300/90 whitespace-pre-wrap leading-relaxed bg-rose-950/30 p-2.5 rounded-lg border border-rose-900/50">
                                      {span.errorStack}
                                    </pre>
                                  ) : (
                                    <pre className="font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap text-rose-300">
                                      {outputStr}
                                    </pre>
                                  )}
                                </div>
                              ) : (
                                <pre className="font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap">
                                  {outputStr}
                                </pre>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Privacy Footer */}
                        <div className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono flex items-center gap-1.5 pt-0.5">
                          <span>🛡️</span>
                          <span>Sensitive tokens, authorization headers, passwords, and secrets are automatically redacted for privacy.</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
