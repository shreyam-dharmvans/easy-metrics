'use client';

import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { TimeSeriesPoint } from '../../types';

interface LatencyTrendChartProps {
  data: TimeSeriesPoint[];
  isLoading?: boolean;
}

export function LatencyTrendChart({ data, isLoading = false }: LatencyTrendChartProps) {
  // Format timestamps for compact X-axis display (e.g. "14:30")
  const chartData = data.map((d) => {
    const date = new Date(d.timestamp);
    const timeLabel = !isNaN(date.getTime())
      ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.timestamp;

    return {
      ...d,
      timeLabel,
    };
  });

  return (
    <div className="p-5 rounded-xl border border-zinc-300/90 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs flex flex-col justify-between transition-colors">
      {/* Header & Legend */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-sm font-bold text-zinc-950 dark:text-white">
            Latency &amp; Response Speed Trend
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Continuous response duration (Average vs Peak Spike in ms)
          </p>
        </div>

        {/* Legend pills */}
        <div className="flex items-center gap-3 text-xs font-semibold">
          <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
            <span className="w-3 h-1 rounded bg-emerald-500"></span> Avg Duration
          </span>
          <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
            <span className="w-3 h-1 rounded border-t-2 border-dashed border-rose-500"></span> Peak Outlier
          </span>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="bg-zinc-50 dark:bg-zinc-950/60 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800/80 min-h-[220px] flex items-center justify-center">
        {isLoading ? (
          <div className="text-xs text-zinc-400 font-mono animate-pulse">
            Loading latency timeseries...
          </div>
        ) : chartData.length === 0 ? (
          <div className="text-xs text-zinc-400 font-medium">
            No latency points recorded in this timeframe
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
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
                unit="ms"
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const avg = payload.find((p) => p.dataKey === 'avgLatencyMs')?.value || 0;
                    const peak = payload.find((p) => p.dataKey === 'peakLatencyMs')?.value || 0;

                    return (
                      <div className="bg-zinc-900 dark:bg-zinc-950 text-white p-2.5 rounded-lg border border-zinc-700 shadow-xl text-xs font-mono">
                        <div className="font-bold text-zinc-300 mb-1 border-b border-zinc-800 pb-1">
                          {label}
                        </div>
                        <div className="text-emerald-400">Avg Duration: {avg}ms</div>
                        <div className="text-rose-400">Peak Spike: {peak}ms</div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              {/* Avg Latency line (Solid Emerald) */}
              <Line
                type="monotone"
                dataKey="avgLatencyMs"
                name="Avg Duration"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, stroke: '#10b981', strokeWidth: 2 }}
              />
              {/* Peak Outlier line (Dashed Rose) */}
              <Line
                type="monotone"
                dataKey="peakLatencyMs"
                name="Peak Spike"
                stroke="#f43f5e"
                strokeWidth={1.5}
                strokeDasharray="4 4"
                dot={false}
                activeDot={{ r: 4, stroke: '#f43f5e', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
