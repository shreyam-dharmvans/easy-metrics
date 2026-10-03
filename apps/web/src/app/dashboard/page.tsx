'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Navbar } from '../../components/navbar/Navbar';
import { DashboardToolbar } from '../../components/dashboard/DashboardToolbar';
import { ActiveRouteBanner } from '../../components/dashboard/ActiveRouteBanner';
import { StatCard } from '../../components/dashboard/StatCard';
import { TrafficVolumeChart } from '../../components/dashboard/TrafficVolumeChart';
import { LatencyTrendChart } from '../../components/dashboard/LatencyTrendChart';
import { SpeedDistributionChart } from '../../components/dashboard/SpeedDistributionChart';
import { StatusAndLaunchpad } from '../../components/dashboard/StatusAndLaunchpad';
import { useThresholds } from '../../context/ThresholdContext';
import { useProject } from '../../context/ProjectContext';
import { fetchOverview, fetchRoutes } from '../../lib/api';
import { OverviewMetrics, RouteMetric } from '../../types';

function DashboardView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const routeParam = searchParams.get('route');

  const { thresholds } = useThresholds();
  const { currentProject } = useProject();

  // Dashboard filter & timeframe state
  const [timeframe, setTimeframe] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('easymetrics_timeframe') || '7d';
      } catch { }
    }
    return '7d';
  });
  const [customRange, setCustomRange] = useState<{ startDate: string; endDate: string } | null>(null);
  const [intervalMs, setIntervalMs] = useState<number | null>(10000); // 10s auto-refresh default
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);

  // Metrics Data
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [routes, setRoutes] = useState<RouteMetric[]>([]);

  // Fetch metrics data from API
  const loadData = useCallback(
    async (isBackground = false) => {
      if (!isBackground) setLoading(true);
      setIsRefreshing(true);

      const targetProjectId = currentProject.id !== 'default' ? currentProject.id : undefined;

      try {
        const [overviewData, routesData] = await Promise.all([
          fetchOverview({
            timeframe,
            route: routeParam || undefined,
            fast: thresholds.fastMs,
            slow: thresholds.slowMs,
            startDate: timeframe === 'custom' ? customRange?.startDate : undefined,
            endDate: timeframe === 'custom' ? customRange?.endDate : undefined,
            projectId: targetProjectId,
          }),
          fetchRoutes(timeframe, targetProjectId),
        ]);

        setMetrics(overviewData);
        setRoutes(routesData);
        setLastRefreshed(new Date());
      } catch (err) {
        console.error('Failed to load dashboard metrics:', err);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [timeframe, routeParam, thresholds.fastMs, thresholds.slowMs, customRange, currentProject.id]
  );

  // Re-fetch on filter, project, or timeframe change
  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // Reset route filter and custom range when project changes
  useEffect(() => {
    if (routeParam) {
      router.replace('/dashboard');
    }
    setCustomRange(null);
  }, [currentProject.id]);

  // Handle clearing the route filter
  const handleClearRoute = () => {
    router.push('/dashboard');
  };

  // Handle preset timeframe change (15m, 1h, 24h, 7d) -> resets custom range
  const handleTimeframeChange = (tf: string) => {
    if (tf !== 'custom') {
      setCustomRange(null);
    }
    setTimeframe(tf);
    try {
      localStorage.setItem('easymetrics_timeframe', tf);
    } catch { }
  };

  // Handle custom timeframe apply -> overwrites previous custom range
  const handleCustomRangeApply = (startDate: string, endDate: string) => {
    setCustomRange({ startDate, endDate });
    setTimeframe('custom');
    try {
      localStorage.setItem('easymetrics_timeframe', 'custom');
    } catch { }
  };

  // Compute degraded routes count
  const degradedRoutesCount = routes.filter((r) => r.avgLatencyMs > thresholds.slowMs).length;

  // Active metrics with graceful zero-data fallback
  const displayMetrics: OverviewMetrics = metrics || {
    totalRequests: 0,
    requestsPerMinute: 0,
    avgLatencyMs: 0,
    p50LatencyMs: 0,
    p95LatencyMs: 0,
    p99LatencyMs: 0,
    peakLatencyMs: 0,
    errorRatePercent: 0,
    fastRequestsCount: 0,
    moderateRequestsCount: 0,
    slowRequestsCount: 0,
    slowRequestsPercent: 0,
    statusBreakdown: { ok: 0, clientError: 0, serverError: 0 },
    thresholds: { fast: thresholds.fastMs, slow: thresholds.slowMs },
    timeSeries: [],
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors">
      {/* 1. Global Navigation Bar (Minimal & Clean) */}
      <Navbar />

      {/* 2. Main Dashboard Content */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 flex-1">
        {/* Page Toolbar (Title, Live status, Latency Tiers, Auto-refresh, and Timeframe) */}
        <DashboardToolbar
          timeframe={timeframe}
          onTimeframeChange={handleTimeframeChange}
          onCustomRangeApply={handleCustomRangeApply}
          onRefresh={() => loadData(true)}
          isRefreshing={isRefreshing}
          lastRefreshed={lastRefreshed}
          intervalMs={intervalMs}
          onIntervalChange={setIntervalMs}
          metrics={metrics}
          routes={routes}
        />
        {/* Contextual Route Filter Banner (only visible if ?route= is present in URL) */}
        <ActiveRouteBanner
          route={routeParam}
          onClear={handleClearRoute}
          metrics={metrics}
          routeMetric={routes.find((r) => r.route === routeParam)}
          timeframe={timeframe}
        />

        {/* Loading Skeleton */}
        {loading && !metrics ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-28 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 animate-pulse p-5"
                />
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-64 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 animate-pulse" />
              <div className="h-64 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 animate-pulse" />
            </div>
          </div>
        ) : (
          <>
            {/* 3. The 4 Golden Signal KPI Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {/* Card 1: Throughput */}
              <StatCard
                title="Throughput (RPM)"
                value={displayMetrics.requestsPerMinute}
                description={`${displayMetrics.totalRequests.toLocaleString()} total requests in window`}
                badgeText={displayMetrics.requestsPerMinute > 0 ? '+14.2% ↑' : 'Idle'}
                badgeVariant={displayMetrics.requestsPerMinute > 0 ? 'success' : 'neutral'}
              />

              {/* Card 2: Avg Response Time */}
              <StatCard
                title="Avg Response Time"
                value={Math.round(displayMetrics.avgLatencyMs)}
                unit="ms"
                badgeText={displayMetrics.avgLatencyMs < thresholds.fastMs ? 'Snappy' : 'Normal'}
                badgeVariant={displayMetrics.avgLatencyMs < thresholds.fastMs ? 'success' : 'warning'}
                description="Global average across routes"
              />

              {/* Card 3: Slow Requests (>slowMs) */}
              <StatCard
                title={`Slow Requests (>${thresholds.slowMs}ms)`}
                value={displayMetrics.slowRequestsCount}
                unit="reqs"
                badgeText={`${displayMetrics.slowRequestsPercent}%`}
                badgeVariant={displayMetrics.slowRequestsCount > 0 ? 'warning' : 'success'}
                isWarning={displayMetrics.slowRequestsCount > 10}
                description={
                  displayMetrics.slowRequestsCount > 0
                    ? `⚠️ ${displayMetrics.slowRequestsCount} requests breached SLO`
                    : 'All requests within SLO budget'
                }
              />

              {/* Card 4: Failed Requests (5xx) */}
              <StatCard
                title="Failed Requests (5xx)"
                value={displayMetrics.statusBreakdown.serverError}
                unit="errors"
                badgeText={`${displayMetrics.errorRatePercent}%`}
                badgeVariant={displayMetrics.statusBreakdown.serverError > 0 ? 'danger' : 'success'}
                description={
                  displayMetrics.statusBreakdown.serverError > 0
                    ? 'Unhandled server exceptions'
                    : 'Zero 5xx server exceptions'
                }
              />
            </div>

            {/* 4. Row 1: Primary Charts (Traffic vs Dedicated Latency Trend) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <TrafficVolumeChart data={displayMetrics.timeSeries} isLoading={isRefreshing} />
              <LatencyTrendChart data={displayMetrics.timeSeries} isLoading={isRefreshing} />
            </div>

            {/* 5. Row 2: Speed Experience Distribution & Explorer Launchpad */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <SpeedDistributionChart
                data={displayMetrics.timeSeries}
                fastMs={thresholds.fastMs}
                slowMs={thresholds.slowMs}
                isLoading={isRefreshing}
              />
              <StatusAndLaunchpad
                totalRequests={displayMetrics.totalRequests}
                statusBreakdown={displayMetrics.statusBreakdown}
                routesCount={routes.length}
                degradedRoutesCount={degradedRoutesCount}
                tracesCount={displayMetrics.totalRequests}
                slowTracesCount={displayMetrics.slowRequestsCount}
              />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center text-xs font-mono text-zinc-500">
          Loading EasyMetrics Dashboard...
        </div>
      }
    >
      <DashboardView />
    </Suspense>
  );
}
