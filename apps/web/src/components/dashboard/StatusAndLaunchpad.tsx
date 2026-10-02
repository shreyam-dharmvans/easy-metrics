'use client';

import React from 'react';
import Link from 'next/link';
import { useProject } from '../../context/ProjectContext';

interface StatusAndLaunchpadProps {
  totalRequests: number;
  statusBreakdown: {
    ok: number;
    clientError: number;
    serverError: number;
  };
  routesCount: number;
  degradedRoutesCount: number;
  tracesCount: number;
  slowTracesCount: number;
}

export function StatusAndLaunchpad({
  totalRequests,
  statusBreakdown,
  routesCount,
  degradedRoutesCount,
  tracesCount,
  slowTracesCount,
}: StatusAndLaunchpadProps) {
  const { isDemo } = useProject();
  const okPct = totalRequests > 0 ? ((statusBreakdown.ok / totalRequests) * 100).toFixed(1) : '0';
  const clientErrPct =
    totalRequests > 0 ? ((statusBreakdown.clientError / totalRequests) * 100).toFixed(1) : '0';
  const serverErrPct =
    totalRequests > 0 ? ((statusBreakdown.serverError / totalRequests) * 100).toFixed(1) : '0';

  return (
    <div className="p-5 rounded-xl border border-zinc-300/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs flex flex-col justify-between transition-colors">
      <div>
        <h3 className="text-sm font-bold text-zinc-950 dark:text-white mb-1">
          Status Composition &amp; Explorer Launchpad
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
          Live HTTP status breakdown &amp; direct links to dedicated explorer pages
        </p>

        {/* Status Volume Breakdown Progress Bars */}
        <div className="space-y-3 mb-6 bg-zinc-50 dark:bg-zinc-950/60 p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-800/80">
          {/* 2xx Success Bar */}
          <div>
            <div className="flex justify-between text-xs mb-1 font-medium">
              <span className="flex items-center gap-1.5 font-semibold text-emerald-700 dark:text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span> 2xx Success
              </span>
              <span className="font-mono text-zinc-700 dark:text-zinc-300 font-bold">
                {statusBreakdown.ok.toLocaleString()} reqs ({okPct}%)
              </span>
            </div>
            <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-emerald-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${okPct}%` }}
              ></div>
            </div>
          </div>

          {/* 4xx Client Error Bar */}
          {statusBreakdown.clientError > 0 && (
            <div>
              <div className="flex justify-between text-xs mb-1 font-medium">
                <span className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span> 4xx Client Errors
                </span>
                <span className="font-mono text-amber-700 dark:text-amber-300 font-bold">
                  {statusBreakdown.clientError.toLocaleString()} reqs ({clientErrPct}%)
                </span>
              </div>
              <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${clientErrPct}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* 5xx Server Exceptions Bar */}
          <div>
            <div className="flex justify-between text-xs mb-1 font-medium">
              <span className="flex items-center gap-1.5 font-semibold text-rose-700 dark:text-rose-400">
                <span className="w-2 h-2 rounded-full bg-rose-600"></span> 5xx Server Exceptions
              </span>
              <span className="font-mono text-rose-600 dark:text-rose-400 font-bold">
                {statusBreakdown.serverError.toLocaleString()} errors ({serverErrPct}%)
              </span>
            </div>
            <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-rose-600 h-2 rounded-full transition-all duration-500"
                style={{ width: `${serverErrPct}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* 2 High-Craft Explorer Launchpad Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        {/* Launchpad 1: Routes */}
        <Link
          href={isDemo ? "/dashboard/routes?demo=true" : "/dashboard/routes"}
          className="p-3.5 rounded-lg border-2 border-zinc-200 dark:border-zinc-800 hover:border-indigo-500 dark:hover:border-indigo-500 bg-white dark:bg-zinc-800/60 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-xs text-zinc-950 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 flex items-center gap-1.5 transition-colors">
              <span>🎯 API Routes Explorer</span>
            </span>
            <span className="text-zinc-400 group-hover:translate-x-0.5 group-hover:text-indigo-600 transition-all">
              →
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {routesCount} active endpoints · {degradedRoutesCount} degraded
          </p>
          <div className="mt-2 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">
            Group by prefix (/api/*) &amp; inspect
          </div>
        </Link>

        {/* Launchpad 2: Traces */}
        <Link
          href={isDemo ? "/dashboard/traces?demo=true" : "/dashboard/traces"}
          className="p-3.5 rounded-lg border-2 border-zinc-200 dark:border-zinc-800 hover:border-emerald-500 dark:hover:border-emerald-500 bg-white dark:bg-zinc-800/60 transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-bold text-xs text-zinc-950 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 flex items-center gap-1.5 transition-colors">
              <span>⚡ Traces Explorer</span>
            </span>
            <span className="text-zinc-400 group-hover:translate-x-0.5 group-hover:text-emerald-600 transition-all">
              →
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {tracesCount.toLocaleString()} captured traces · {slowTracesCount} slow
          </p>
          <div className="mt-2 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
            Search by route, status &amp; timings
          </div>
        </Link>
      </div>
    </div>
  );
}
