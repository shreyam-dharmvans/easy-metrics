'use client';

import React from 'react';
import { RouteMetric, ThresholdConfig } from '../../types';

interface RoutesSummaryCardsProps {
  routes: RouteMetric[];
  thresholds: ThresholdConfig;
}

export function RoutesSummaryCards({ routes, thresholds }: RoutesSummaryCardsProps) {
  const totalEndpoints = routes.length;
  const totalCalls = routes.reduce((sum, r) => sum + r.totalCalls, 0);

  // Find fastest endpoint
  const fastestRoute = [...routes].sort((a, b) => a.avgLatencyMs - b.avgLatencyMs)[0];

  // Find top bottleneck endpoint (highest P95 latency)
  const slowestRoute = [...routes].sort((a, b) => b.p95LatencyMs - a.p95LatencyMs)[0];

  // Count degraded endpoints (either high P95 or errors)
  const degradedRoutes = routes.filter(
    (r) => r.p95LatencyMs > thresholds.slowMs || r.errorRatePercent > 0
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {/* 1. Monitored Endpoints */}
      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
          <span>Active Endpoints</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono">
            {totalCalls.toLocaleString()} calls
          </span>
        </div>
        <div className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white mt-2">
          {totalEndpoints}
        </div>
        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
          Monitored HTTP routes with telemetry
        </div>
      </div>

      {/* 2. Fastest Endpoint */}
      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
          <span>Fastest Route</span>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium">
            Snappy
          </span>
        </div>
        <div className="text-xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400 mt-2 truncate">
          {fastestRoute ? `${fastestRoute.avgLatencyMs}ms` : '—'}
        </div>
        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 truncate font-mono">
          {fastestRoute ? fastestRoute.route : 'No active routes'}
        </div>
      </div>

      {/* 3. Top Bottleneck Route (Max P95) */}
      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
          <span>Peak Outlier (P95)</span>
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${slowestRoute && slowestRoute.p95LatencyMs > thresholds.slowMs
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              }`}
          >
            {slowestRoute && slowestRoute.p95LatencyMs > thresholds.slowMs ? 'Exceeds SLO' : 'Moderate'}
          </span>
        </div>
        <div className="text-xl font-bold tracking-tight text-zinc-950 dark:text-white mt-2">
          {slowestRoute ? `${slowestRoute.p95LatencyMs}ms` : '—'}
        </div>
        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 truncate font-mono">
          {slowestRoute ? slowestRoute.route : 'No bottleneck'}
        </div>
      </div>

      {/* 4. Degraded or Erroring Endpoints */}
      <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 font-medium">
          <span>Degraded Endpoints</span>
          <span
            className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${degradedRoutes.length > 0
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              }`}
          >
            {degradedRoutes.length > 0 ? `${degradedRoutes.length} flagged` : 'All healthy'}
          </span>
        </div>
        <div className="text-2xl font-bold tracking-tight text-zinc-950 dark:text-white mt-2">
          {degradedRoutes.length}
        </div>
        <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
          Routes with errors or latency &gt;{thresholds.slowMs}ms
        </div>
      </div>
    </div>
  );
}
