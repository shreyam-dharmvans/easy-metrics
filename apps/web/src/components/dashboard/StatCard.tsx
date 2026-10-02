'use client';

import React from 'react';

export interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  badgeText?: string;
  badgeVariant?: 'success' | 'warning' | 'danger' | 'neutral';
  description?: string;
  isWarning?: boolean;
}

export function StatCard({
  title,
  value,
  unit,
  badgeText,
  badgeVariant = 'neutral',
  description,
  isWarning = false,
}: StatCardProps) {
  // Color styling for the upper-right status pill badge
  const badgeStyles = {
    success:
      'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800',
    warning:
      'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800',
    danger:
      'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800',
    neutral:
      'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-700',
  };

  // Color styling for the large primary numeric metric
  const valueColor = {
    success: 'text-emerald-600 dark:text-emerald-400',
    warning: 'text-amber-600 dark:text-amber-400',
    danger: 'text-rose-600 dark:text-rose-400',
    neutral: 'text-zinc-950 dark:text-white',
  }[badgeVariant];

  return (
    <div
      className={`p-5 rounded-xl bg-white dark:bg-zinc-900 shadow-xs transition-all ${isWarning
          ? 'border-2 border-amber-400/90 dark:border-amber-500/70'
          : 'border border-zinc-300/90 dark:border-zinc-800'
        }`}
    >
      {/* Top Row: Metric Title + Status Pill */}
      <div className="flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400 mb-2 font-medium">
        <span className="font-semibold text-zinc-800 dark:text-zinc-200">{title}</span>
        {badgeText && (
          <span
            className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${badgeStyles[badgeVariant]}`}
          >
            {badgeText}
          </span>
        )}
      </div>

      {/* Primary Big Metric Number */}
      <div className={`text-3xl font-extrabold tracking-tight font-mono ${valueColor}`}>
        {value}
        {unit && <span className="text-lg font-normal text-zinc-500 ml-1">{unit}</span>}
      </div>

      {/* Subtext description below the metric */}
      {description && (
        <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-medium truncate">
          {description}
        </div>
      )}
    </div>
  );
}
