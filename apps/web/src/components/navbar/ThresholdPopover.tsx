'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useThresholds } from '../../context/ThresholdContext';

export function ThresholdPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const { thresholds, updateThresholds, resetThresholds } = useThresholds();

  // Close when clicking outside of the popover container
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const presets = [
    {
      name: '⚡ Standard Web API',
      desc: 'REST & GraphQL services',
      fast: 150,
      slow: 500,
      bottleneck: 40,
    },
    {
      name: '🚀 Microservices',
      desc: 'Internal RPC & Redis caches',
      fast: 50,
      slow: 200,
      bottleneck: 30,
    },
    {
      name: '🤖 AI & Data Pipelines',
      desc: 'LLMs, embeddings, and ETLs',
      fast: 1000,
      slow: 3000,
      bottleneck: 50,
    },
  ];

  return (
    <div className="relative" ref={popoverRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium shadow-2xs transition-colors cursor-pointer shrink-0"
        title="Customize latency tiers and bottleneck threshold"
      >
        <span className="text-amber-500">⚡</span>
        <span className="hidden sm:inline">Latency Tiers</span>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-mono">
          &lt;{thresholds.fastMs}ms / &gt;{thresholds.slowMs}ms
        </span>
      </button>

      {/* Popover Panel */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-88 max-w-sm p-4 rounded-xl border-2 border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl z-50 text-left animate-in fade-in zoom-in-95 duration-100">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-200 dark:border-zinc-800">
            <div>
              <h4 className="text-xs font-bold text-zinc-950 dark:text-white flex items-center gap-1.5">
                <span>⚡ Latency &amp; Bottlenecks</span>
              </h4>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                Set thresholds for speed categories and alerts
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-sm font-bold cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Quick Presets */}
          <div className="mb-4">
            <span className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 tracking-wider block mb-2">
              1-Click Industry Presets
            </span>
            <div className="space-y-1.5">
              {presets.map((preset) => {
                const isSelected =
                  thresholds.fastMs === preset.fast &&
                  thresholds.slowMs === preset.slow &&
                  thresholds.bottleneckPercent === preset.bottleneck;

                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      updateThresholds({
                        fastMs: preset.fast,
                        slowMs: preset.slow,
                        bottleneckPercent: preset.bottleneck,
                      });
                    }}
                    className={`w-full text-left p-2 rounded-lg border text-xs transition-all cursor-pointer ${isSelected
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 font-semibold'
                      : 'border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-300'
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{preset.name}</span>
                      <span className="font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
                        &lt;{preset.fast}ms / &gt;{preset.slow}ms
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {preset.desc} · Bottleneck: &ge;{preset.bottleneck}%
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Fine-Grained Inputs */}
          <div className="space-y-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <span className="text-[10px] uppercase font-bold text-zinc-500 dark:text-zinc-400 tracking-wider block">
              Custom Values
            </span>

            {/* Fast Threshold */}
            <div className="flex items-center justify-between text-xs">
              <div>
                <label className="font-medium text-zinc-800 dark:text-zinc-200 block">
                  Fast Request Tier (&lt;)
                </label>
                <span className="text-[10px] text-zinc-500">Considered snappy</span>
              </div>
              <div className="flex items-center gap-1 font-mono">
                <input
                  type="number"
                  min="1"
                  max="10000"
                  value={thresholds.fastMs}
                  onChange={(e) =>
                    updateThresholds({ fastMs: Math.max(1, Number(e.target.value)) })
                  }
                  className="w-20 px-2 py-1 text-right text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-semibold text-zinc-900 dark:text-white focus:outline-none focus:border-indigo-600"
                />
                <span className="text-[11px] text-zinc-500">ms</span>
              </div>
            </div>

            {/* Slow Threshold */}
            <div className="flex items-center justify-between text-xs">
              <div>
                <label className="font-medium text-zinc-800 dark:text-zinc-200 block">
                  Slow Request Tier (&gt;)
                </label>
                <span className="text-[10px] text-zinc-500">Triggers slow warning</span>
              </div>
              <div className="flex items-center gap-1 font-mono">
                <input
                  type="number"
                  min="1"
                  max="60000"
                  value={thresholds.slowMs}
                  onChange={(e) =>
                    updateThresholds({ slowMs: Math.max(1, Number(e.target.value)) })
                  }
                  className="w-20 px-2 py-1 text-right text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-semibold text-zinc-900 dark:text-white focus:outline-none focus:border-indigo-600"
                />
                <span className="text-[11px] text-zinc-500">ms</span>
              </div>
            </div>

            {/* Bottleneck Percentage */}
            <div className="flex items-center justify-between text-xs">
              <div>
                <label className="font-medium text-zinc-800 dark:text-zinc-200 block">
                  Bottleneck Span Ratio (&ge;)
                </label>
                <span className="text-[10px] text-zinc-500">Flags culprit span in traces</span>
              </div>
              <div className="flex items-center gap-1 font-mono">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={thresholds.bottleneckPercent}
                  onChange={(e) =>
                    updateThresholds({
                      bottleneckPercent: Math.min(100, Math.max(1, Number(e.target.value))),
                    })
                  }
                  className="w-20 px-2 py-1 text-right text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-semibold text-zinc-900 dark:text-white focus:outline-none focus:border-indigo-600"
                />
                <span className="text-[11px] text-zinc-500">%</span>
              </div>
            </div>
          </div>

          {/* Reset Action */}
          <div className="mt-4 pt-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
            <button
              type="button"
              onClick={resetThresholds}
              className="text-[11px] text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 font-medium transition-colors cursor-pointer"
            >
              Reset to Defaults
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

