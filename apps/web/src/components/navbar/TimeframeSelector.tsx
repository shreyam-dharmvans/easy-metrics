'use client';

import React, { useState, useRef, useEffect } from 'react';

interface TimeframeSelectorProps {
  timeframe: string;
  onTimeframeChange: (newTimeframe: string) => void;
  onCustomRangeApply?: (startDate: string, endDate: string) => void;
}

export function TimeframeSelector({
  timeframe,
  onTimeframeChange,
  onCustomRangeApply,
}: TimeframeSelectorProps) {
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Default custom range: 24h ago to now
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 16);
  });
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().slice(0, 16);
  });

  // Click-outside listener to close the custom range popover
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsCustomOpen(false);
      }
    }

    if (isCustomOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCustomOpen]);

  const quickOptions = [
    { label: '15m', value: '15m' },
    { label: '1h', value: '1h' },
    { label: '24h', value: '24h' },
    { label: '7d', value: '7d' },
  ];

  const handleApplyCustom = () => {
    if (onCustomRangeApply && startDate && endDate) {
      onCustomRangeApply(new Date(startDate).toISOString(), new Date(endDate).toISOString());
      onTimeframeChange('custom');
      setIsCustomOpen(false);
    }
  };

  return (
    <div className="relative flex items-center shrink-0" ref={popoverRef}>
      {/* Timeframe Buttons Container */}
      <div className="flex items-center bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-medium shadow-2xs">
        {quickOptions.map((opt) => {
          const isActive = timeframe === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onTimeframeChange(opt.value)}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer ${isActive
                  ? 'bg-white dark:bg-zinc-800 font-semibold text-zinc-950 dark:text-white shadow-2xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                }`}
            >
              {opt.label}
            </button>
          );
        })}

        {/* Custom Range Button */}
        <button
          type="button"
          onClick={() => setIsCustomOpen(!isCustomOpen)}
          className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1 cursor-pointer ${timeframe === 'custom'
              ? 'bg-white dark:bg-zinc-800 font-semibold text-zinc-950 dark:text-white shadow-2xs'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
            }`}
        >
          <span>Custom</span>
          <span className="text-[10px] text-zinc-400">▾</span>
        </button>
      </div>

      {/* Custom Date Range Popover */}
      {isCustomOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl z-50 text-left">
          <div className="text-xs font-bold text-zinc-950 dark:text-white mb-3">
            Custom Time Range
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                Start Date &amp; Time
              </label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono text-xs focus:outline-none focus:border-indigo-600"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-zinc-600 dark:text-zinc-400 block mb-1">
                End Date &amp; Time
              </label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-mono text-xs focus:outline-none focus:border-indigo-600"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setIsCustomOpen(false)}
              className="px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApplyCustom}
              className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-white text-white dark:text-zinc-900 rounded-md text-xs font-semibold shadow-2xs cursor-pointer"
            >
              Apply Range
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
