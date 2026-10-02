'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { RouteMetric, ThresholdConfig } from '../../types';
import { generateRouteCursorPrompt } from '../../lib/promptGenerator';

interface RoutesTableProps {
  routes: RouteMetric[];
  thresholds: ThresholdConfig;
}

type SortField = 'calls' | 'avgLatency' | 'p95Latency' | 'errorRate' | 'route';
type SortOrder = 'asc' | 'desc';

export function RoutesTable({ routes, thresholds }: RoutesTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string>('ALL');
  const [sortField, setSortField] = useState<SortField>('calls');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [copiedRoute, setCopiedRoute] = useState<string | null>(null);

  const totalCallsAll = routes.reduce((sum, r) => sum + r.totalCalls, 0);

  // Standard HTTP methods to always display with route counts
  const STANDARD_METHODS = ['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'];

  const methodCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: routes.length };
    for (const m of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
      counts[m] = routes.filter((r) => r.method.toUpperCase() === m).length;
    }
    return counts;
  }, [routes]);

  // Handle header click to toggle sort
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const handleCopyRoutePrompt = (e: React.MouseEvent, route: RouteMetric) => {
    e.preventDefault();
    e.stopPropagation();
    const prompt = generateRouteCursorPrompt(route, '7d', thresholds);
    navigator.clipboard.writeText(prompt);
    setCopiedRoute(route.route);
    setTimeout(() => setCopiedRoute(null), 2000);
  };

  // Filter and sort routes (supports substring search, e.g. "error" matches "/api/simulate-error")
  const filteredRoutes = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const queryTokens = query.split(/\s+/).filter(Boolean);

    return routes
      .filter((r) => {
        const matchesMethod = selectedMethod === 'ALL' || r.method.toUpperCase() === selectedMethod;
        if (!matchesMethod) return false;

        if (queryTokens.length === 0) return true;

        const targetString = `${r.method} ${r.route}`.toLowerCase();
        return queryTokens.every((token) => targetString.includes(token));
      })
      .sort((a, b) => {
        let diff = 0;
        switch (sortField) {
          case 'calls':
            diff = a.totalCalls - b.totalCalls;
            break;
          case 'avgLatency':
            diff = a.avgLatencyMs - b.avgLatencyMs;
            break;
          case 'p95Latency':
            diff = a.p95LatencyMs - b.p95LatencyMs;
            break;
          case 'errorRate':
            diff = a.errorRatePercent - b.errorRatePercent;
            break;
          case 'route':
            diff = a.route.localeCompare(b.route);
            break;
        }
        return sortOrder === 'asc' ? diff : -diff;
      });
  }, [routes, searchQuery, selectedMethod, sortField, sortOrder]);

  // Method badge styling helper
  const getMethodBadge = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20';
      case 'POST':
        return 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20';
      case 'PUT':
      case 'PATCH':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'DELETE':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
      default:
        return 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20';
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs overflow-hidden">
      {/* Table Filter & Search Controls */}
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400 text-xs">
            🔍
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search routes by path or method..."
            className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-indigo-500 transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* HTTP Method Pills with Live Route Counts */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {STANDARD_METHODS.map((m) => {
            const count = methodCounts[m] || 0;
            const isSelected = selectedMethod === m;
            const hasRoutes = count > 0 || m === 'ALL';

            return (
              <button
                key={m}
                type="button"
                onClick={() => hasRoutes && setSelectedMethod(m)}
                disabled={!hasRoutes}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${isSelected
                  ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-2xs cursor-pointer'
                  : hasRoutes
                    ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white cursor-pointer'
                    : 'bg-zinc-50 dark:bg-zinc-900/40 text-zinc-400 dark:text-zinc-600 border border-dashed border-zinc-200 dark:border-zinc-800 cursor-not-allowed opacity-50'
                  }`}
                title={hasRoutes ? `Filter by ${m} endpoints` : `No ${m} routes detected in this timeframe`}
              >
                <span>{m}</span>
                <span
                  className={`text-[10px] px-1 py-0.2 rounded font-mono ${isSelected
                    ? 'bg-white/20 dark:bg-zinc-900/20 text-white dark:text-zinc-900'
                    : hasRoutes
                      ? 'bg-zinc-200/70 dark:bg-zinc-700/60 text-zinc-600 dark:text-zinc-400'
                      : 'text-zinc-400 dark:text-zinc-600'
                    }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Table Data View */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 text-zinc-500 dark:text-zinc-400 uppercase text-[10px] tracking-wider font-semibold">
              <th
                onClick={() => handleSort('route')}
                className="py-3 px-4 cursor-pointer hover:text-zinc-900 dark:hover:text-white select-none"
              >
                <div className="flex items-center gap-1">
                  <span>Endpoint &amp; Route</span>
                  {sortField === 'route' && <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                </div>
              </th>
              <th
                onClick={() => handleSort('calls')}
                className="py-3 px-4 cursor-pointer hover:text-zinc-900 dark:hover:text-white select-none"
              >
                <div className="flex items-center gap-1">
                  <span>Throughput / Calls</span>
                  {sortField === 'calls' && <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                </div>
              </th>
              <th
                onClick={() => handleSort('avgLatency')}
                className="py-3 px-4 cursor-pointer hover:text-zinc-900 dark:hover:text-white select-none"
              >
                <div className="flex items-center gap-1">
                  <span>Avg Duration</span>
                  {sortField === 'avgLatency' && <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                </div>
              </th>
              <th
                onClick={() => handleSort('p95Latency')}
                className="py-3 px-4 cursor-pointer hover:text-zinc-900 dark:hover:text-white select-none"
              >
                <div className="flex items-center gap-1">
                  <span>P95 Outlier</span>
                  {sortField === 'p95Latency' && <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                </div>
              </th>
              <th
                onClick={() => handleSort('errorRate')}
                className="py-3 px-4 cursor-pointer hover:text-zinc-900 dark:hover:text-white select-none"
              >
                <div className="flex items-center gap-1">
                  <span>Error Rate</span>
                  {sortField === 'errorRate' && <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>}
                </div>
              </th>
              <th className="py-3 px-4 text-right">Drilldown Actions</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {filteredRoutes.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-zinc-500 dark:text-zinc-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <span className="text-2xl">🔍</span>
                    <p className="font-semibold text-zinc-900 dark:text-white text-sm">
                      No matching API routes found
                    </p>
                    <p className="text-xs">
                      Try adjusting your search query, method filter, or timeframe.
                    </p>
                    {(searchQuery || selectedMethod !== 'ALL') && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setSelectedMethod('ALL');
                        }}
                        className="mt-2 px-3 py-1 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredRoutes.map((r) => {
                const callSharePercent = totalCallsAll > 0 ? (r.totalCalls / totalCallsAll) * 100 : 0;

                // Latency categorization based on user's active thresholds
                let latencyBadge = {
                  label: 'Fast',
                  className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
                };
                if (r.avgLatencyMs > thresholds.slowMs) {
                  latencyBadge = {
                    label: 'Slow',
                    className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
                  };
                } else if (r.avgLatencyMs > thresholds.fastMs) {
                  latencyBadge = {
                    label: 'Moderate',
                    className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
                  };
                }

                const hasErrors = r.errorRatePercent > 0;

                return (
                  <tr
                    key={r.route}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 transition-colors group"
                  >
                    {/* 1. Endpoint & Route */}
                    <td className="py-3.5 px-4 font-mono">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold border ${getMethodBadge(
                            r.method
                          )}`}
                        >
                          {r.method}
                        </span>
                        <span className="font-semibold text-zinc-900 dark:text-white truncate max-w-xs sm:max-w-md">
                          {(r.route || '').replace(/^(GET|POST|PUT|PATCH|DELETE)\s+/, '')}
                        </span>
                      </div>
                    </td>

                    {/* 2. Throughput / Calls + Share */}
                    <td className="py-3.5 px-4">
                      <div>
                        <span className="font-semibold text-zinc-900 dark:text-white">
                          {r.totalCalls.toLocaleString()}
                        </span>
                        <span className="text-[11px] text-zinc-400 ml-1.5 font-mono">
                          ({callSharePercent.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-24 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${Math.min(100, Math.max(5, callSharePercent))}%` }}
                        />
                      </div>
                    </td>

                    {/* 3. Avg Duration + Tier */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-zinc-900 dark:text-white font-mono">
                          {r.avgLatencyMs}ms
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-semibold border ${latencyBadge.className}`}
                        >
                          {latencyBadge.label}
                        </span>
                      </div>
                    </td>

                    {/* 4. P95 Outlier */}
                    <td className="py-3.5 px-4 font-mono">
                      <span
                        className={
                          r.p95LatencyMs > thresholds.slowMs
                            ? 'text-rose-600 dark:text-rose-400 font-semibold'
                            : 'text-zinc-700 dark:text-zinc-300'
                        }
                      >
                        {r.p95LatencyMs}ms
                      </span>
                    </td>

                    {/* 5. Error Rate */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${hasErrors
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 font-semibold'
                          : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                          }`}
                      >
                        {r.errorRatePercent.toFixed(1)}%
                      </span>
                    </td>

                    {/* 6. Drilldown Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={(e) => handleCopyRoutePrompt(e, r)}
                          className="px-2.5 py-1 rounded-md bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/80 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
                          title="Copy complete route performance summary & telemetry for Cursor / Copilot"
                        >
                          <span>{copiedRoute === r.route ? '✓ Copied!' : '📋 Copy Prompt'}</span>
                        </button>
                        <Link
                          href={`/dashboard?route=${encodeURIComponent(r.route)}`}
                          className="px-2.5 py-1 rounded-md bg-zinc-100 hover:bg-indigo-50 dark:bg-zinc-800 dark:hover:bg-indigo-950/40 text-zinc-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-zinc-200 dark:border-zinc-700 text-xs font-medium transition-colors"
                          title="Filter Golden Signals dashboard for this route"
                        >
                          Dashboard ↗
                        </Link>
                        <Link
                          href={`/dashboard/traces?route=${encodeURIComponent(r.route)}`}
                          className="px-2.5 py-1 rounded-md bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 text-xs font-medium transition-colors"
                          title="Inspect trace waterfall records for this route"
                        >
                          Traces 🔍
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
    </div>
  );
}
