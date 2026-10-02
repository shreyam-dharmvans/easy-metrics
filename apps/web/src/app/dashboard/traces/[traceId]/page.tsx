'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Navbar } from '../../../../components/navbar/Navbar';
import { ThresholdPopover } from '../../../../components/navbar/ThresholdPopover';
import { TraceWaterfallView } from '../../../../components/traces/TraceWaterfallView';
import { useThresholds } from '../../../../context/ThresholdContext';
import { useProject } from '../../../../context/ProjectContext';
import { fetchTraceWaterfall } from '../../../../lib/api';
import { generateTraceCursorPrompt } from '../../../../lib/promptGenerator';
import { Trace, Span } from '../../../../types';

export default function TraceDetailPage() {
  const { thresholds } = useThresholds();
  const { currentProject, isDemo } = useProject();
  const params = useParams();
  const searchParams = useSearchParams();
  const traceId = (params?.traceId as string) || '';

  const [data, setData] = useState<{ trace: Trace; spans: Span[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  useEffect(() => {
    if (!traceId) return;
    setLoading(true);

    const targetProject = currentProject.id !== 'default' ? currentProject.id : undefined;

    fetchTraceWaterfall(traceId, targetProject)
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        console.error('Failed to load trace waterfall:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [traceId, currentProject.id]);

  const handleCopyTraceId = () => {
    if (!traceId) return;
    navigator.clipboard.writeText(traceId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1500);
  };

  const handleCopyCursorPrompt = () => {
    if (!data) return;
    const prompt = generateTraceCursorPrompt(data.trace, data.spans, thresholds);
    navigator.clipboard.writeText(prompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors">
      {/* 1. Global Navigation Bar - project switcher hidden because trace is tied to its specific project */}
      <Navbar showProjectSwitcher={false} />

      {/* 2. Main Page Container */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 flex-1 space-y-6">
        {/* Back navigation & Actions bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link
              href={isDemo ? "/dashboard/traces?demo=true" : "/dashboard/traces"}
              className="inline-flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white font-bold bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-2xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <span>← Back to Traces</span>
            </Link>
            <Link
              href={isDemo ? "/dashboard?demo=true" : "/dashboard"}
              className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white font-medium bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-2xs hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              <span>Dashboard Overview</span>
            </Link>
          </div>

          <div className="flex items-center gap-2">
            <ThresholdPopover />
            <button
              type="button"
              onClick={handleCopyCursorPrompt}
              disabled={!data}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-lg text-xs font-bold shadow-xs transition-opacity cursor-pointer disabled:opacity-50"
              title="Copy complete chronological span timeline & diagnostics formatted for Cursor / Copilot"
            >
              <span>⚡</span>
              <span>{copiedPrompt ? '✓ Copied Prompt for AI!' : 'Copy Prompt for Cursor / Copilot'}</span>
            </button>
          </div>
        </div>

        {loading || !data ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-32 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800" />
            <div className="h-96 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800" />
          </div>
        ) : (
          <>
            {/* Trace Summary Card */}
            <div className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                    <span
                      className={`px-2.5 py-1 rounded font-mono font-bold text-xs border ${data.trace.hasError
                        ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                        : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                        }`}
                    >
                      {data.trace.statusCode} {data.trace.hasError ? 'SERVER ERROR' : 'OK'}
                    </span>
                    <h1 className="text-xl font-extrabold font-mono text-zinc-950 dark:text-white">
                      {data.trace.route}
                    </h1>
                    <span className="text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono border border-zinc-200 dark:border-zinc-700 font-semibold">
                      prod-env
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                    <div className="flex items-center gap-1.5">
                      <span>Trace ID:</span>
                      <button
                        type="button"
                        onClick={handleCopyTraceId}
                        className="hover:text-zinc-950 dark:hover:text-white underline cursor-pointer"
                        title="Copy Trace ID"
                      >
                        {data.trace.id}
                      </button>
                      <span>{copiedId ? '✓' : ''}</span>
                    </div>
                    <span>•</span>
                    <span>Service: <strong className="text-zinc-700 dark:text-zinc-300">node-service</strong></span>
                    <span>•</span>
                    <span>Timestamp: <strong className="text-zinc-700 dark:text-zinc-300">{new Date(data.trace.timestamp).toLocaleTimeString()}</strong></span>
                    <span>•</span>
                    <span>Total Spans: <strong className="text-zinc-700 dark:text-zinc-300">{data.spans.length} spans</strong></span>
                  </div>
                </div>

                <div className="text-left sm:text-right">
                  <div
                    className={`text-3xl font-extrabold font-mono ${data.trace.durationMs > thresholds.slowMs
                      ? 'text-rose-600 dark:text-rose-400'
                      : data.trace.durationMs > thresholds.fastMs
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                      }`}
                  >
                    {data.trace.durationMs}ms
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 font-medium">
                    Total Duration (Wall Clock)
                  </div>
                </div>
              </div>

              {/* Latency Breakdown Bar */}
              {(() => {
                const totalMs = Math.max(1, data.trace.durationMs);
                const nonRootSpans = data.spans.filter((s) => s.id !== data.trace.id && s.parentSpanId);

                const dbDuration = nonRootSpans
                  .filter((s) => s.kind === 'INTERNAL' || s.name.toLowerCase().includes('select') || s.name.toLowerCase().includes('from') || s.name.includes('DatabaseQuery'))
                  .reduce((sum, s) => sum + s.durationMs, 0);

                const extDuration = nonRootSpans
                  .filter((s) => s.kind === 'CLIENT' || s.name.startsWith('http') || s.name.includes('redis') || s.name.includes('cache') || s.name.includes('api.'))
                  .reduce((sum, s) => sum + s.durationMs, 0);

                const childTotal = nonRootSpans.reduce((sum, s) => sum + s.durationMs, 0);
                const computeDuration = Math.max(0, Math.round((totalMs - childTotal) * 10) / 10);

                return (
                  <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                    <div className="flex flex-wrap items-center justify-between text-xs font-mono text-zinc-500 dark:text-zinc-400 gap-2">
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        Duration Breakdown:
                      </span>
                      <div className="flex flex-wrap items-center gap-3 text-[11px]">
                        {dbDuration > 0 && (
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500 inline-block shrink-0" />
                            <span>Database: <strong className="text-zinc-800 dark:text-zinc-200">{dbDuration}ms ({Math.round((dbDuration / totalMs) * 100)}%)</strong></span>
                          </span>
                        )}
                        {extDuration > 0 && (
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-sm bg-purple-500 inline-block shrink-0" />
                            <span>Cache / HTTP: <strong className="text-zinc-800 dark:text-zinc-200">{extDuration}ms ({Math.round((extDuration / totalMs) * 100)}%)</strong></span>
                          </span>
                        )}
                        {computeDuration > 0 && (
                          <span className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-sm bg-zinc-400 dark:bg-zinc-600 inline-block shrink-0" />
                            <span>Server Compute &amp; Overhead: <strong className="text-zinc-800 dark:text-zinc-200">{computeDuration}ms ({Math.round((computeDuration / totalMs) * 100)}%)</strong></span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Proportional Segmented Progress Bar */}
                    <div className="w-full h-2 rounded-full overflow-hidden flex bg-zinc-200 dark:bg-zinc-800">
                      {dbDuration > 0 && (
                        <div
                          style={{ width: `${(dbDuration / totalMs) * 100}%` }}
                          className="bg-amber-500 h-full"
                          title={`Database: ${dbDuration}ms (${Math.round((dbDuration / totalMs) * 100)}%)`}
                        />
                      )}
                      {extDuration > 0 && (
                        <div
                          style={{ width: `${(extDuration / totalMs) * 100}%` }}
                          className="bg-purple-500 h-full"
                          title={`Cache / HTTP: ${extDuration}ms (${Math.round((extDuration / totalMs) * 100)}%)`}
                        />
                      )}
                      {computeDuration > 0 && (
                        <div
                          style={{ width: `${(computeDuration / totalMs) * 100}%` }}
                          className="bg-zinc-400 dark:bg-zinc-600 h-full"
                          title={`Server Compute & Overhead: ${computeDuration}ms (${Math.round((computeDuration / totalMs) * 100)}%)`}
                        />
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Trace Visualization (Waterfall + Flamegraph) */}
            <TraceWaterfallView
              trace={data.trace}
              spans={data.spans}
              fullPageView={true}
            />
          </>
        )}
      </main>
    </div>
  );
}
