'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useThresholds } from '../../context/ThresholdContext';

interface DurationOption {
  label: string;
  shortLabel: string;
  value: number | undefined;
  badge?: {
    text: string;
    className: string;
  };
}

interface DurationFilterDropdownProps {
  minDurationMs: number | undefined;
  onMinDurationChange: (duration: number | undefined) => void;
}

export function DurationFilterDropdown({
  minDurationMs,
  onMinDurationChange,
}: DurationFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { thresholds } = useThresholds();

  // Dynamic options tied directly to user-configured latency tiers
  const options: DurationOption[] = [
    {
      label: 'Any Duration',
      shortLabel: 'Any Duration',
      value: undefined,
    },
    {
      label: `> ${thresholds.fastMs}ms`,
      shortLabel: `> ${thresholds.fastMs}ms`,
      value: thresholds.fastMs,
      badge: {
        text: 'Moderate / Slow',
        className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      },
    },
    {
      label: `> ${thresholds.slowMs}ms`,
      shortLabel: `> ${thresholds.slowMs}ms`,
      value: thresholds.slowMs,
      badge: {
        text: 'SLO Breach',
        className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 font-bold',
      },
    },
    {
      label: `> ${thresholds.slowMs * 2}ms`,
      shortLabel: `> ${thresholds.slowMs * 2 >= 1000 ? `${(thresholds.slowMs * 2) / 1000}s` : `${thresholds.slowMs * 2}ms`}`,
      value: thresholds.slowMs * 2,
      badge: {
        text: 'Severe Spike',
        className: 'bg-rose-600/20 text-rose-700 dark:text-rose-300 border-rose-600/30 font-bold',
      },
    },
  ];

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIsOpen(false);
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const selectedOption =
    options.find((opt) => opt.value === minDurationMs) || {
      label: minDurationMs ? `> ${minDurationMs}ms` : 'Any Duration',
      shortLabel: minDurationMs ? `> ${minDurationMs}ms` : 'Any Duration',
      value: minDurationMs,
      badge: undefined,
    };

  return (
    <div className="relative inline-block text-left shrink-0" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer shadow-2xs ${selectedOption.value !== undefined
            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30'
            : 'bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800'
          }`}
        title="Filter traces by minimum execution duration"
      >
        <span className="text-[11px]">⏱️</span>
        <span>{selectedOption.shortLabel}</span>
        {selectedOption.badge && (
          <span className={`px-1.5 py-0.2 rounded text-[10px] border ${selectedOption.badge.className}`}>
            {selectedOption.badge.text}
          </span>
        )}
        <span className={`text-[10px] text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-60 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl py-1.5 z-50 text-xs text-zinc-700 dark:text-zinc-200 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
            Duration Threshold (Dynamic)
          </div>
          <div className="py-1">
            {options.map((opt) => {
              const isSelected = opt.value === minDurationMs;
              return (
                <button
                  key={opt.label}
                  type="button"
                  onClick={() => {
                    onMinDurationChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer ${isSelected ? 'font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20' : ''
                    }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{opt.label}</span>
                    {opt.badge && (
                      <span className={`px-1.5 py-0.2 rounded text-[10px] border ${opt.badge.className}`}>
                        {opt.badge.text}
                      </span>
                    )}
                  </div>
                  {isSelected && <span className="text-indigo-600 dark:text-indigo-400 font-bold">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
