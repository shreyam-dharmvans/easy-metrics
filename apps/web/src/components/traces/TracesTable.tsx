'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Trace, ThresholdConfig, TopSpan } from '../../types';

interface TracesTableProps {
  traces: Trace[];
  thresholds: ThresholdConfig;
  onSelectTrace?: (traceId: string) => void;
  page: number;
  totalPages: number;
  onPageChange: (newPage: number) => void;
  selectedTraceId?: string | null;
}

export function TracesTable({
  traces,
  thresholds,
  page,
  totalPages,
  onPageChange,
}: TracesTableProps) {
  const router = useRouter();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyId = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Helper for status badge styling
  const getStatusBadge = (code: number, hasError: boolean) => {
    if (hasError || code >= 500) {
      return 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800';
    }
    if (code >= 400) {
      return 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800';
    }
    return 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800';
  };

  // Helper for HTTP method badge
  const getMethodBadge = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20';
      case 'POST':
        return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'PUT':
      case 'PATCH':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'DELETE':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
      default:
        return 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20';
    }
  };

  // Helper for total duration block and latency tier (using dynamic user thresholds)
  const getLatencyStyle = (durationMs: number) => {
    if (durationMs > thresholds.slowMs) {
      return {
        label: 'Slow',
        boxClass: 'bg-rose-100/80 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800',
        pillClass: 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30',
      };
    }
    if (durationMs > thresholds.fastMs) {
      return {
        label: 'Moderate',
        boxClass: 'bg-amber-100/80 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800',
        pillClass: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
      };
    }
    return {
      label: 'Fast',
      boxClass: 'bg-emerald-100/80 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800',
      pillClass: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
    };
  };

  // Helper for span colored blocks and accurate bottleneck isolation
  const getSpanBlock = (span: TopSpan, traceDurationMs: number, rootRoute: string) => {
    const safeTraceDur = Math.max(1, traceDurationMs);
    const pct = Math.min(100, Math.round((span.durationMs / safeTraceDur) * 100));

    const rawName = span.name || '';
    let icon = '•';
    let label = rawName;
    let style = 'bg-zinc-100 dark:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700';

    const isRoot =
      span.kind === 'SERVER' ||
      rawName === rootRoute ||
      rawName.startsWith('GET /') ||
      rawName.startsWith('POST /') ||
      rawName.startsWith('PUT /') ||
      rawName.startsWith('DELETE /');

    const isDb =
      span.kind === 'INTERNAL' ||
      rawName.toLowerCase().includes('select') ||
      rawName.toLowerCase().includes('from') ||
      rawName.startsWith('DatabaseQuery') ||
      rawName.toLowerCase().includes('prisma') ||
      rawName.toLowerCase().includes('insert') ||
      rawName.toLowerCase().includes('update');

    const isClient =
      span.kind === 'CLIENT' ||
      rawName.startsWith('http') ||
      rawName.includes('https://') ||
      rawName.includes('api.stripe') ||
      rawName.includes('rates.currencyapi');

    const isCache = rawName.toLowerCase().includes('redis') || rawName.toLowerCase().includes('cache');

    // Accuracy rule:
    // 1. Root span is NEVER a bottleneck.
    // 2. Non-root spans exceeding bottleneckPercent (or slowMs) are tagged as bottlenecks in red.
    const isBottleneck =
      !isRoot &&
      !isCache &&
      (pct >= thresholds.bottleneckPercent || span.durationMs >= thresholds.slowMs);

    if (isDb) {
      icon = '🗄️';
      const match = rawName.match(/FROM\s+"?([a-zA-Z0-9_]+)"?/i);
      label = match ? `db:${match[1]}` : rawName.replace(/^DatabaseQuery:\s*/, '').slice(0, 18);
      style = 'bg-amber-100/80 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300/70 dark:border-amber-800/70 font-medium';
    } else if (isClient) {
      icon = '🌐';
      try {
        const urlMatch = rawName.match(/https?:\/\/([^\/\s]+)/);
        label = urlMatch ? `api:${urlMatch[1]}` : 'ext-api';
      } catch {
        label = 'ext-api';
      }
      style = 'bg-purple-100/80 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-300/70 dark:border-purple-800/70 font-medium';
    } else if (isCache) {
      icon = '⚡';
      label = rawName.replace(/^ioredis:\s*/, '').slice(0, 18);
      style = 'bg-cyan-100/80 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-300 border-cyan-300/70 dark:border-cyan-800/70 font-medium';
    } else if (isRoot) {
      icon = '⚡';
      label = rawName.replace(/^(GET|POST|PUT|DELETE)\s+/, '').slice(0, 18);
      style = 'bg-sky-100/80 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-300/70 dark:border-sky-800/70 font-medium';
    }

    // Error or real slow bottleneck overrides
    if (span.hasError) {
      icon = '⚠️';
      style = 'bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border-rose-400 dark:border-rose-700 font-bold';
    } else if (isBottleneck) {
      icon = '⚡';
      style = 'bg-rose-100/90 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-700 font-bold shadow-2xs';
    }

    return { icon, label, style, pct, isBottleneck };
  };

  // Relative time helper
  const getRelativeTime = (isoString: string) => {
    const diffSec = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
    if (diffSec < 60) return `${Math.max(1, diffSec)}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 text-zinc-500 dark:text-zinc-400 uppercase text-[10px] tracking-wider font-semibold">
              <th className="py-3 px-4">Status &amp; Method</th>
              <th className="py-3 px-4">Endpoint Route</th>
              <th className="py-3 px-4">Trace ID</th>
              <th className="py-3 px-4">Total Duration</th>
              <th className="py-3 px-4">Spans &amp; Top Bottlenecks</th>
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-4 text-right">Waterfall Timeline</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {traces.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-zinc-500 dark:text-zinc-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <span className="text-2xl">⚡</span>
                    <p className="font-semibold text-zinc-900 dark:text-white text-sm">
                      No traces found
                    </p>
                    <p className="text-xs">
                      Try widening the timeframe or adjusting status and duration filters.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              traces.map((trace) => {
                const latency = getLatencyStyle(trace.durationMs);
                const method = trace.httpMethod || trace.method || 'GET';
                const rawRoute = trace.rootRoute || trace.route || '';
                const displayRoute = rawRoute ? rawRoute.replace(/^(GET|POST|PUT|PATCH|DELETE)\s+/, '') : '—';

                return (
                  <tr
                    key={trace.id}
                    onClick={() => router.push(`/dashboard/traces/${trace.id}`)}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors cursor-pointer group"
                  >
                    {/* 1. Status & Method */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center justify-center font-mono font-bold px-2 py-0.5 rounded text-[11px] border ${getStatusBadge(
                            trace.statusCode,
                            trace.hasError
                          )}`}
                        >
                          {trace.statusCode}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${getMethodBadge(
                            method
                          )}`}
                        >
                          {method}
                        </span>
                      </div>
                    </td>

                    {/* 2. Endpoint Route */}
                    <td className="py-3 px-4 font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate max-w-xs block">
                          {displayRoute}
                        </span>
                        {trace.hasError && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-bold shrink-0">
                            ⚠️ failed
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 3. Trace ID + Copy */}
                    <td className="py-3 px-4 font-mono">
                      <button
                        type="button"
                        onClick={(e) => handleCopyId(e, trace.id)}
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-zinc-100/90 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700/80 text-[11px] text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                        title="Copy full Trace ID"
                      >
                        <span>{trace.id.slice(0, 8)}...</span>
                        <span className="text-[10px]">{copiedId === trace.id ? '✓' : '📋'}</span>
                      </button>
                    </td>

                    {/* 4. Total Duration (Colored Block + Tier) */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-bold font-mono px-2 py-0.5 rounded text-xs border ${latency.boxClass}`}
                        >
                          {trace.durationMs}ms
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${latency.pillClass}`}
                        >
                          {latency.label}
                        </span>
                      </div>
                    </td>

                    {/* 5. Spans & Top Bottlenecks (Clean Semantic Colored Badges Only) */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap max-w-md">
                        {trace.topSpans && trace.topSpans.length > 0 ? (
                          trace.topSpans.map((span, idx) => {
                            const block = getSpanBlock(span, trace.durationMs, rawRoute);
                            return (
                              <span
                                key={idx}
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] border font-mono truncate max-w-[210px] transition-transform hover:scale-[1.02] ${block.style}`}
                                title={`${span.name} — ${span.durationMs}ms (${block.pct}% of total request)`}
                              >
                                <span className="text-[10px] shrink-0">{block.icon}</span>
                                <span className="truncate">{block.label}</span>
                                <span className="font-bold opacity-90 shrink-0">
                                  {span.durationMs}ms
                                </span>
                                <span className="text-[10px] opacity-75 shrink-0">
                                  ({block.pct}%)
                                </span>
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-[11px] text-zinc-400">1 span</span>
                        )}
                      </div>
                    </td>

                    {/* 6. Timestamp */}
                    <td className="py-3 px-4 text-zinc-500 dark:text-zinc-400 font-mono text-[11px] whitespace-nowrap">
                      <span title={new Date(trace.timestamp).toISOString()}>
                        {getRelativeTime(trace.timestamp)}
                      </span>
                    </td>

                    {/* 7. Action Buttons */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/dashboard/traces/${trace.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white border border-zinc-200 dark:border-zinc-700/80 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
                          title="Open full Waterfall Timeline view"
                        >
                          <span>Waterfall</span>
                          <span className="text-[10px]">→</span>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          <div>
            Page <strong className="text-zinc-900 dark:text-white">{page}</strong> of{' '}
            <strong className="text-zinc-900 dark:text-white">{totalPages}</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
              className="px-2.5 py-1 rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
