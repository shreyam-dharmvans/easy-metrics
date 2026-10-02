'use client';

import React from 'react';
import { DurationFilterDropdown } from './DurationFilterDropdown';

interface TracesFilterBarProps {
  searchRoute: string;
  onSearchChange: (val: string) => void;
  statusFilter: string;
  onStatusChange: (status: string) => void;
  minDurationMs: number | undefined;
  onMinDurationChange: (duration: number | undefined) => void;
  totalTraces: number;
}

export function TracesFilterBar({
  searchRoute,
  onSearchChange,
  statusFilter,
  onStatusChange,
  minDurationMs,
  onMinDurationChange,
  totalTraces,
}: TracesFilterBarProps) {
  const statusOptions = [
    { label: 'ALL', value: 'all' },
    { label: '2xx (OK)', value: '2xx' },
    { label: '4xx (Client)', value: '4xx' },
    { label: '5xx (Error)', value: '5xx' },
  ];

  return (
    <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs mb-6 flex flex-col md:flex-row md:items-center justify-between gap-3">
      {/* Search Input (Route or Trace ID) */}
      <div className="relative flex-1 max-w-md">
        <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400 text-xs">
          🔍
        </span>
        <input
          type="text"
          value={searchRoute}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filter by endpoint path or trace ID..."
          className="w-full pl-8 pr-8 py-1.5 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-indigo-500 transition-colors"
        />
        {searchRoute && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xs cursor-pointer"
          >
            ✕
          </button>
        )}
      </div>

      {/* Filter Controls Group */}
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Status Code Pills */}
        <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700/80 text-xs">
          {statusOptions.map((opt) => {
            const isSelected = statusFilter === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => onStatusChange(opt.value)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${isSelected
                  ? 'bg-white dark:bg-zinc-700 text-zinc-950 dark:text-white shadow-2xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                  }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        {/* Min Duration Dropdown */}
        <DurationFilterDropdown
          minDurationMs={minDurationMs}
          onMinDurationChange={onMinDurationChange}
        />

        {/* Total Results Count */}
        <span className="text-[11px] text-zinc-400 font-mono ml-1">
          {totalTraces} {totalTraces === 1 ? 'trace' : 'traces'}
        </span>
      </div>
    </div>
  );
}
