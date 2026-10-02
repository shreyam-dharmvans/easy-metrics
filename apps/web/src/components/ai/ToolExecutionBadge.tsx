'use client';

import React, { useState } from 'react';
import { ToolExecution } from '../../types/ai';

interface ToolBadgeProps {
  tool: ToolExecution;
}

export function ToolExecutionBadge({ tool }: ToolBadgeProps) {
  const [expanded, setExpanded] = useState(false);

  // Human-friendly description based on LangGraph tool name
  const getToolMeta = (name: string, args?: Record<string, any>) => {
    switch (name) {
      case 'get_route_health':
        return {
          icon: '📊',
          label: args?.route ? `Analyzing route ${args.route}` : 'Computing route health & latency percentiles',
          color: 'indigo',
        };
      case 'get_trace_waterfall':
        return {
          icon: '⚡',
          label: args?.trace_id ? `Inspecting trace waterfall (${String(args.trace_id).slice(0, 8)}...)` : 'Inspecting trace waterfall & bottlenecks',
          color: 'amber',
        };
      case 'get_recent_errors':
        return {
          icon: '🚨',
          label: 'Retrieving recent 500 error stack traces',
          color: 'rose',
        };
      case 'execute_custom_sql':
        return {
          icon: '🔍',
          label: 'Executing telemetry SQL query',
          color: 'purple',
        };
      case 'get_db_schema':
        return {
          icon: '📋',
          label: 'Verifying database telemetry schema',
          color: 'cyan',
        };
      case 'get_project_context':
        return {
          icon: '⚙️',
          label: 'Loading project context',
          color: 'zinc',
        };
      default:
        return {
          icon: '🔧',
          label: `Calling tool: ${name}`,
          color: 'indigo',
        };
    }
  };

  const meta = getToolMeta(tool.name, tool.args);
  const isRunning = tool.status === 'running';

  return (
    <div className="inline-block my-1 text-xs">
      <div
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all ${isRunning
          ? 'bg-indigo-50/80 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 animate-pulse'
          : 'bg-zinc-100 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700/80 text-zinc-700 dark:text-zinc-300'
          }`}
      >
        {/* Status Icon: Spinner when running, checkmark when completed */}
        {isRunning ? (
          <svg className="animate-spin w-3 h-3 text-indigo-600 dark:text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
        ) : (
          <span className="text-emerald-500 font-bold text-[11px]">✓</span>
        )}

        {/* Tool Meta Icon & Label */}
        <span className="text-[12px]">{meta.icon}</span>
        <span className="font-medium text-[11px]">{meta.label}</span>

        {/* Collapsible toggle for args if present */}
        {tool.args && Object.keys(tool.args).length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="ml-1 text-[10px] text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 underline font-mono cursor-pointer"
          >
            {expanded ? 'hide args' : 'args'}
          </button>
        )}
      </div>

      {/* Expanded Arguments Inspector */}
      {expanded && tool.args && (
        <div className="mt-1 p-2 rounded-md bg-zinc-950 text-zinc-200 font-mono text-[10px] border border-zinc-800 overflow-x-auto max-w-md">
          <pre>{JSON.stringify(tool.args, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

