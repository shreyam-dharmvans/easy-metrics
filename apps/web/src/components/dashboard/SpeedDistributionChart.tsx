'use client';

import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { TimeSeriesPoint } from '../../types';

interface SpeedDistributionChartProps {
  data: TimeSeriesPoint[];
  fastMs: number;
  slowMs: number;
  isLoading?: boolean;
}

export function SpeedDistributionChart({
  data,
  fastMs,
  slowMs,
  isLoading = false,
}: SpeedDistributionChartProps) {
  // Format percentage distributions and time labels for each bucket
  const chartData = data.map((d) => {
    const total = d.fast + d.moderate + d.slow;
    const fastPct = total > 0 ? Number(((d.fast / total) * 100).toFixed(1)) : 0;
    const modPct = total > 0 ? Number(((d.moderate / total) * 100).toFixed(1)) : 0;
    const slowPct = total > 0 ? Number(((d.slow / total) * 100).toFixed(1)) : 0;

    const date = new Date(d.timestamp);
    const timeLabel = !isNaN(date.getTime())
      ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.timestamp;

    return {
      ...d,
      timeLabel,
      fastPct,
      modPct,
      slowPct,
      totalSpeedReqs: total,
    };
  });

  return (
    <div className="p-5 rounded-xl border border-zinc-300/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs flex flex-col justify-between transition-colors">
      {/* Header & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
            User Speed Experience
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Percentage of requests experiencing fast vs sluggish loads
          </p>
        </div>

        {/* Legend pills with dynamic threshold values */}
        <div className="flex items-center gap-3 text-xs font-semibold">
          <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500"></span> Fast &lt;{fastMs}ms
          </span>
          <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-500"></span> Moderate
          </span>
          <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
            <span className="w-2.5 h-2.5 rounded-xs bg-rose-500"></span> Slow &gt;{slowMs}ms
          </span>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="bg-zinc-50 dark:bg-zinc-950/60 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800/80 min-h-[220px] flex items-center justify-center">
        {isLoading ? (
          <div className="text-xs text-zinc-400 font-mono animate-pulse">
            Loading speed distribution...
          </div>
        ) : chartData.length === 0 ? (
          <div className="text-xs text-zinc-400 font-medium">
            No latency distribution recorded in this timeframe
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="currentColor"
                className="text-zinc-200 dark:text-zinc-800/60"
              />
              <XAxis
                dataKey="timeLabel"
                stroke="currentColor"
                className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500"
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="currentColor"
                className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500"
                tickLine={false}
                axisLine={false}
                unit="%"
                domain={[0, 100]}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const d = payload[0].payload;
                    return (
                      <div className="bg-zinc-900 dark:bg-zinc-950 text-white p-2.5 rounded-lg border border-zinc-700 shadow-xl text-xs font-mono">
                        <div className="font-bold text-zinc-300 mb-1 border-b border-zinc-800 pb-1">
                          {label} · {d.totalSpeedReqs} requests
                        </div>
                        <div className="text-emerald-400">
                          ⚡ Fast (&lt;{fastMs}ms): {d.fast} ({d.fastPct}%)
                        </div>
                        <div className="text-amber-400">
                          🟡 Moderate: {d.moderate} ({d.modPct}%)
                        </div>
                        <div className="text-rose-400 font-bold">
                          🔴 Slow (&gt;{slowMs}ms): {d.slow} ({d.slowPct}%)
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {/* Stacked 100% Distribution Bars */}
              <Bar dataKey="fastPct" name="Fast" stackId="speed" fill="#10b981" />
              <Bar dataKey="modPct" name="Moderate" stackId="speed" fill="#f59e0b" />
              <Bar dataKey="slowPct" name="Slow" stackId="speed" fill="#f43f5e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

