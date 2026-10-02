'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { generateRouteCursorPrompt } from '../../lib/promptGenerator';
import { useThresholds } from '../../context/ThresholdContext';
import { RouteMetric, OverviewMetrics } from '../../types';

interface ActiveRouteBannerProps {
  route: string | null;
  onClear: () => void;
  routeMetric?: RouteMetric;
  metrics?: OverviewMetrics | null;
  timeframe?: string;
}

export function ActiveRouteBanner({
  route,
  onClear,
  routeMetric,
  metrics,
  timeframe = '7d',
}: ActiveRouteBannerProps) {
  const [copied, setCopied] = useState(false);
  const { thresholds } = useThresholds();

  // If not filtering, render nothing (pure clean dashboard!)
  if (!route || route === 'all') {
    return null;
  }

  const handleCopyPrompt = () => {
    const routeData: RouteMetric = routeMetric
      ? routeMetric
      : {
        route,
        method: 'GET',
        totalCalls: metrics?.totalRequests ?? 1,
        avgLatencyMs: metrics?.avgLatencyMs ?? 0,
        p95LatencyMs: metrics?.p95LatencyMs ?? 0,
        errorRatePercent: metrics?.errorRatePercent ?? 0,
      };
    const prompt = generateRouteCursorPrompt(routeData, timeframe, thresholds, metrics);
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 px-4 mb-6 rounded-xl bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/80 text-xs shadow-2xs animate-in fade-in transition-colors">
      {/* Left: Active Route Indicator */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
        <span className="text-zinc-600 dark:text-zinc-400 font-medium">
          Showing metrics isolated to:
        </span>
        <span className="font-mono font-bold text-indigo-950 dark:text-indigo-200 bg-white dark:bg-zinc-900 px-2.5 py-1 rounded-md border border-indigo-200 dark:border-indigo-800 shadow-2xs">
          {route}
        </span>
      </div>

      {/* Right: Actions (Copy Prompt for Cursor / Copilot / Browse all routes / Clear filter) */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={handleCopyPrompt}
          className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-2xs cursor-pointer font-semibold"
          title="Copy route performance summary & optimization goals for Cursor / Copilot"
        >
          <span>⚡</span>
          <span>{copied ? '✓ Copied Prompt!' : 'Copy Prompt for Cursor / Copilot'}</span>
        </button>

        <Link
          href="/dashboard/routes"
          className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-medium transition-colors"
        >
          Browse all routes →
        </Link>

        <button
          type="button"
          onClick={onClear}
          title="Reset to all routes"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-300 transition-colors shadow-2xs cursor-pointer font-semibold"
        >
          <span>Clear Filter</span>
          <span className="text-[11px]">✕</span>
        </button>
      </div>
    </div>
  );
}
