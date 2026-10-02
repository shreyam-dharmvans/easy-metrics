'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchTraceWaterfall } from '../../lib/api';
import { Trace, Span } from '../../types';
import { TraceWaterfallView } from './TraceWaterfallView';
import { generateTraceCursorPrompt } from '../../lib/promptGenerator';
import { useThresholds } from '../../context/ThresholdContext';

interface TraceWaterfallDrawerProps {
  traceId: string | null;
  projectId?: string;
  onClose: () => void;
}

export function TraceWaterfallDrawer({
  traceId,
  projectId,
  onClose,
}: TraceWaterfallDrawerProps) {
  const { thresholds } = useThresholds();
  const [data, setData] = useState<{ trace: Trace; spans: Span[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Fetch trace waterfall when traceId changes
  useEffect(() => {
    if (!traceId) {
      setData(null);
      return;
    }

    setLoading(true);
    fetchTraceWaterfall(traceId, projectId)
      .then((res) => {
        setData(res);
      })
      .catch((err) => {
        console.error('Failed to load trace waterfall:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [traceId, projectId]);

  if (!traceId) return null;

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
    <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
      {/* Dimmed Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in"
        onClick={onClose}
      />

      {/* Slide-out Drawer Container */}
      <div className="relative w-full max-w-2xl sm:max-w-3xl lg:max-w-4xl xl:max-w-5xl bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-200 text-xs">
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-start justify-between gap-4 shrink-0 bg-zinc-50/50 dark:bg-zinc-950/40">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`font-mono font-bold px-2 py-0.5 rounded text-[11px] border ${data?.trace.hasError
                  ? 'bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                  : 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                  }`}
              >
                {data?.trace.statusCode || '...'}
              </span>
              <h2 className="text-base font-bold text-zinc-950 dark:text-white font-mono truncate">
                {data?.trace.route || 'Loading trace...'}
              </h2>
            </div>

            <div className="flex items-center gap-3 mt-1.5 text-zinc-500 dark:text-zinc-400 font-mono text-[11px]">
              <div className="flex items-center gap-1.5">
                <span>ID:</span>
                <button
                  type="button"
                  onClick={handleCopyTraceId}
                  className="hover:text-zinc-950 dark:hover:text-white underline cursor-pointer"
                  title="Copy full trace ID"
                >
                  {traceId}
                </button>
                <span>{copiedId ? '✓ Copied' : ''}</span>
              </div>
              <span>·</span>
              <div>
                Duration: <strong className="text-zinc-900 dark:text-white">{data?.trace.durationMs}ms</strong>
              </div>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Open Full Flamegraph Page button */}
            <Link
              href={`/dashboard/traces/${traceId}${projectId ? `?projectId=${projectId}` : ''}`}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-semibold shadow-2xs transition-colors"
              title="Open full page flamegraph view"
            >
              <span>🔥 Full View</span>
              <span className="text-[10px]">↗</span>
            </Link>

            {data && (
              <button
                type="button"
                onClick={handleCopyCursorPrompt}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                title="Copy complete chronological span timeline & diagnostics formatted for Cursor / Copilot"
              >
                <span>⚡</span>
                <span>{copiedPrompt ? '✓ Copied Prompt!' : 'Copy Prompt for Cursor / Copilot'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Close drawer (Esc)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {loading || !data ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-16 bg-zinc-100 dark:bg-zinc-800 rounded-xl" />
              <div className="h-64 bg-zinc-100 dark:bg-zinc-800 rounded-xl" />
            </div>
          ) : (
            <TraceWaterfallView
              trace={data.trace}
              spans={data.spans}
            />
          )}
        </div>
      </div>
    </div>
  );
}
