'use client';

import React from 'react';
import { ThresholdPopover } from '../navbar/ThresholdPopover';
import { RefreshControl } from '../navbar/RefreshControl';
import { TimeframeSelector } from '../navbar/TimeframeSelector';

interface RoutesToolbarProps {
  timeframe: string;
  onTimeframeChange: (tf: string) => void;
  onCustomRangeApply: (startDate: string, endDate: string) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  lastRefreshed: Date;
  intervalMs: number | null;
  onIntervalChange: (interval: number | null) => void;
}

export function RoutesToolbar({
  timeframe,
  onTimeframeChange,
  onCustomRangeApply,
  onRefresh,
  isRefreshing,
  lastRefreshed,
  intervalMs,
  onIntervalChange,
}: RoutesToolbarProps) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 mb-6 border-b border-zinc-200/80 dark:border-zinc-800/80">
      {/* LEFT: Page Title & Badge */}
      <div className="min-w-0 pr-2">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-bold tracking-tight text-zinc-950 dark:text-white">
            API Routes Explorer
          </h1>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            Endpoint Telemetry
          </span>
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xl">
          Detailed response time percentiles, request volume share, and failure rates per HTTP route
        </p>
      </div>

      {/* RIGHT: Page Controls - ALWAYS on ONE crisp row with unclipped popovers */}
      <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
        <ThresholdPopover />
        <RefreshControl
          onRefresh={onRefresh}
          isRefreshing={isRefreshing}
          lastRefreshed={lastRefreshed}
          allowAutoRefresh={true}
          intervalMs={intervalMs}
          onIntervalChange={onIntervalChange}
        />
        <TimeframeSelector
          timeframe={timeframe}
          onTimeframeChange={onTimeframeChange}
          onCustomRangeApply={onCustomRangeApply}
        />
      </div>
    </div>
  );
}
