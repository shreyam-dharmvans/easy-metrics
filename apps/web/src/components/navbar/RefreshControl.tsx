'use client';

import React, { useState, useEffect, useRef } from 'react';

interface RefreshControlProps {
  onRefresh: () => void;
  isRefreshing: boolean;
  lastRefreshed: Date;
  allowAutoRefresh?: boolean; // Default true on Dashboard, false on Routes/Traces
  intervalMs?: number | null;
  onIntervalChange?: (newInterval: number | null) => void;
}

export function RefreshControl({
  onRefresh,
  isRefreshing,
  lastRefreshed,
  allowAutoRefresh = true,
  intervalMs = 10000,
  onIntervalChange,
}: RefreshControlProps) {
  const [secondsAgo, setSecondsAgo] = useState(0);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isDropdownOpen]);

  // 1-second tick to update "Updated Xs ago"
  useEffect(() => {
    const ticker = setInterval(() => {
      const diff = Math.floor((Date.now() - lastRefreshed.getTime()) / 1000);
      setSecondsAgo(Math.max(0, diff));
    }, 1000);

    return () => clearInterval(ticker);
  }, [lastRefreshed]);

  // Auto-refresh interval timer (only active if allowAutoRefresh is true and intervalMs is non-null)
  useEffect(() => {
    if (!allowAutoRefresh || !intervalMs) return;

    const timer = setInterval(() => {
      onRefresh();
    }, intervalMs);

    return () => clearInterval(timer);
  }, [allowAutoRefresh, intervalMs, onRefresh]);

  // Format relative time string
  let timeText = 'Just now';
  if (secondsAgo >= 5 && secondsAgo < 60) {
    timeText = `${secondsAgo}s ago`;
  } else if (secondsAgo >= 60) {
    timeText = `${Math.floor(secondsAgo / 60)}m ago`;
  }

  const intervalOptions = [
    { label: '5s (Real-time)', shortLabel: '5s', ms: 5000 },
    { label: '10s (Standard)', shortLabel: '10s', ms: 10000 },
    { label: '30s (Relaxed)', shortLabel: '30s', ms: 30000 },
    { label: '1m (Slow)', shortLabel: '1m', ms: 60000 },
    { label: 'Paused', shortLabel: 'Paused', ms: null },
  ];

  const currentOption = intervalOptions.find((opt) => opt.ms === intervalMs) || intervalOptions[1];

  return (
    <div className="relative inline-flex items-center rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs text-xs shrink-0" ref={dropdownRef}>
      {/* Interval Selector Button */}
      {allowAutoRefresh && onIntervalChange && (
        <>
          <button
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 font-medium transition-colors cursor-pointer rounded-l-lg"
            title="Configure auto-refresh frequency"
          >
            <span className="text-zinc-400 text-[11px]">⟳</span>
            <span>{currentOption.shortLabel}</span>
            <span className="text-[10px] text-zinc-400 ml-0.5">▾</span>
          </button>

          {/* Custom Styled Dropdown Popover */}
          {isDropdownOpen && (
            <div className="absolute left-0 top-full mt-1.5 w-44 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl py-1.5 z-50 text-xs text-zinc-700 dark:text-zinc-200 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                Refresh Frequency
              </div>
              <div className="py-1">
                {intervalOptions.map((opt) => {
                  const isSelected = intervalMs === opt.ms;
                  return (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => {
                        onIntervalChange(opt.ms);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer ${isSelected
                          ? 'font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                          : 'text-zinc-700 dark:text-zinc-300'
                        }`}
                    >
                      <span>{opt.label}</span>
                      {isSelected && <span className="text-xs">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* Manual Refresh Button + relative time */}
      <button
        type="button"
        onClick={onRefresh}
        disabled={isRefreshing}
        title={`Click to refresh data now (last updated ${timeText})`}
        className="flex items-center gap-1.5 px-2.5 py-1.5 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-50 rounded-r-lg"
      >
        <svg
          className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-600' : 'text-zinc-400 dark:text-zinc-500'}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
          <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
          <path d="M16 21h5v-5" />
        </svg>
        <span className="hidden md:inline text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
          {timeText}
        </span>
      </button>
    </div>
  );
}
