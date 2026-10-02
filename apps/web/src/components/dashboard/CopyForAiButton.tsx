'use client';

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useProject } from '../../context/ProjectContext';
import { useThresholds } from '../../context/ThresholdContext';
import { OverviewMetrics, RouteMetric } from '../../types';

interface CopyForAiButtonProps {
  metrics: OverviewMetrics | null;
  routes?: RouteMetric[];
  timeframe: string;
}

export function CopyForAiButton({ metrics, routes = [], timeframe }: CopyForAiButtonProps) {
  const { currentProject } = useProject();
  const { thresholds } = useThresholds();
  const [copied, setCopied] = useState(false);

  const generateOverviewMarkdown = () => {
    if (!metrics) return '';

    const projectName = currentProject.name || 'My Service';
    const fastPercent =
      metrics.totalRequests > 0
        ? Math.round((metrics.fastRequestsCount / metrics.totalRequests) * 100)
        : 0;

    const formattedRoutes = routes
      .slice(0, 10)
      .map(
        (r) =>
          `| \`${r.method} ${r.route}\` | ${r.totalCalls.toLocaleString()} reqs | ${Math.round(r.avgLatencyMs)}ms | ${Math.round(r.p95LatencyMs)}ms | ${r.errorRatePercent}% |`
      )
      .join('\n');

    return `# EasyMetrics APM Telemetry Overview: ${projectName}
**Timeframe:** Last ${timeframe}
**Generated:** ${new Date().toUTCString()}
**Status:** Monitored via OpenTelemetry & EasyMetrics APM

## 📊 Core Golden Signals
- **Throughput:** ${metrics.requestsPerMinute} RPM (${metrics.totalRequests.toLocaleString()} total requests recorded)
- **Global Latency:** Avg ${Math.round(metrics.avgLatencyMs)}ms | P50: ${Math.round(metrics.p50LatencyMs)}ms | P95: ${Math.round(metrics.p95LatencyMs)}ms | P99: ${Math.round(metrics.p99LatencyMs)}ms
- **Fast Latency Tier (<${thresholds.fastMs}ms):** ${fastPercent}% of traffic (${metrics.fastRequestsCount.toLocaleString()} reqs)
- **Slow Requests (>${thresholds.slowMs}ms):** ${metrics.slowRequestsCount.toLocaleString()} reqs (${metrics.slowRequestsPercent}% SLO breach rate)
- **Server Failures (5xx):** ${metrics.statusBreakdown.serverError.toLocaleString()} errors (${metrics.errorRatePercent}% error rate)
- **Client Errors (4xx):** ${metrics.statusBreakdown.clientError.toLocaleString()} reqs
- **System Availability (2xx/3xx):** ${(100 - metrics.errorRatePercent).toFixed(2)}%

## 🛣️ Top Route Performance & Health
| Route | Total Calls | Avg Latency | P95 Latency | Error Rate |
|---|---|---|---|---|
${formattedRoutes || '| (No route traffic detected in window) | - | - | - | - |'}

---
*Context for AI / LLM: Use the verified APM telemetry data above to analyze system performance, investigate latency bottlenecks, generate technical reports, or evaluate engineering achievements.*
`;
  };

  const handleCopy = async () => {
    const text = generateOverviewMarkdown();
    if (!text) return;

    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy metrics for AI:', err);
    }
  };

  if (!metrics) return null;

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium shadow-2xs transition-colors cursor-pointer shrink-0 select-none ${copied
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 hover:text-zinc-950 dark:hover:text-white'
        }`}
      title="Copy dashboard overview metrics to clipboard for AI / LLM analysis"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-500" />
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">Copied!</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" />
          <span>Copy AI Context</span>
        </>
      )}
    </button>
  );
}
