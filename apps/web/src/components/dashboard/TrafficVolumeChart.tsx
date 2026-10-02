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

interface TrafficVolumeChartProps {
  data: TimeSeriesPoint[];
  isLoading?: boolean;
}

export function TrafficVolumeChart({ data, isLoading = false }: TrafficVolumeChartProps) {
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
            Request Traffic &amp; Error Volume
          </h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Total requests categorized by HTTP status code
          </p>
        </div>

        {/* Legend pills */}
        <div className="flex items-center gap-3 text-xs font-semibold">
          <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500"></span> 2xx OK
          </span>
          <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
            <span className="w-2.5 h-2.5 rounded-xs bg-amber-500"></span> 4xx Error
          </span>
          <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
            <span className="w-2.5 h-2.5 rounded-xs bg-rose-500"></span> 5xx Error
          </span>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="bg-zinc-50 dark:bg-zinc-950/60 p-3 rounded-lg border border-zinc-200 dark:border-zinc-800/80 min-h-[220px] flex items-center justify-center">
        {isLoading ? (
          <div className="text-xs text-zinc-400 font-mono animate-pulse">
            Loading traffic timeseries...
          </div>
        ) : chartData.length === 0 ? (
          <div className="text-xs text-zinc-400 font-medium">
            No request traffic recorded in this timeframe
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
                allowDecimals={false}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const ok = payload.find((p) => p.dataKey === 'ok')?.value || 0;
                    const c4xx = payload.find((p) => p.dataKey === 'clientErrors')?.value || 0;
                    const s5xx = payload.find((p) => p.dataKey === 'serverErrors')?.value || 0;
                    const total = Number(ok) + Number(c4xx) + Number(s5xx);

                    return (
                      <div className="bg-zinc-900 dark:bg-zinc-950 text-white p-2.5 rounded-lg border border-zinc-700 shadow-xl text-xs font-mono">
                        <div className="font-bold text-zinc-300 mb-1 border-b border-zinc-800 pb-1">
                          {label}
                        </div>
                        <div className="text-emerald-400">2xx OK: {ok}</div>
                        {Number(c4xx) > 0 && <div className="text-amber-400">4xx Error: {c4xx}</div>}
                        {Number(s5xx) > 0 && <div className="text-rose-400 font-bold">5xx Error: {s5xx}</div>}
                        <div className="text-zinc-400 text-[11px] pt-1 mt-1 border-t border-zinc-800 font-sans font-medium">
                          Total: {total} requests
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="ok" name="2xx OK" stackId="status" fill="#10b981" />
              <Bar dataKey="clientErrors" name="4xx Error" stackId="status" fill="#f59e0b" />
              <Bar dataKey="serverErrors" name="5xx Error" stackId="status" fill="#f43f5e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
