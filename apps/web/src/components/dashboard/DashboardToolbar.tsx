'use client';

import React from 'react';
import { ThresholdPopover } from '../navbar/ThresholdPopover';
import { RefreshControl } from '../navbar/RefreshControl';
import { TimeframeSelector } from '../navbar/TimeframeSelector';
import { CopyForAiButton } from './CopyForAiButton';
import { OverviewMetrics, RouteMetric } from '../../types';

interface DashboardToolbarProps {
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
  onCustomRangeApply: (startDate: string, endDate: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  lastRefreshed: Date;
  intervalMs: number | null;
  onIntervalChange: (interval: number | null) => void;
  metrics?: OverviewMetrics | null;
  routes?: RouteMetric[];
}

export function DashboardToolbar({
  timeframe,
  onTimeframeChange,
  onCustomRangeApply,
  onRefresh,
  isRefreshing,
  lastRefreshed,
  intervalMs,
  onIntervalChange,
  metrics,
  routes,
}: DashboardToolbarProps) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 mb-6 border-b border-zinc-200/80 dark:border-zinc-800/80">
      {/* LEFT: Page Title & Live Pulse Badge */}
      <div className="min-w-0 pr-2">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-bold tracking-tight text-zinc-950 dark:text-white">
            System Overview
          </h1>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live Telemetry
          </span>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xl">
          Real-time Golden Signals: throughput, latency percentiles, error rates, and route health
        </p>
      </div>

      {/* RIGHT: Page-Level Controls - ALWAYS on ONE crisp row with unclipped popovers */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 shrink-0">
        {/* Copy Metrics for AI / Resume Button */}
        <CopyForAiButton metrics={metrics || null} routes={routes} timeframe={timeframe} />

        {/* Latency Thresholds Popover */}
        <ThresholdPopover />

        {/* Auto-refresh & Manual Refresh Pill */}
        <RefreshControl
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
          lastRefreshed={lastRefreshed}
          allowAutoRefresh={true}
          intervalMs={intervalMs}
          onIntervalChange={onIntervalChange}
        />

        {/* Timeframe Selector Pill */}
        <TimeframeSelector
          timeframe={timeframe}
          onTimeframeChange={onTimeframeChange}
          onCustomRangeApply={onCustomRangeApply}
        />
      </div>
    </div>
  );
}
