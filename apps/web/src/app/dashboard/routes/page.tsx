'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { Navbar } from '../../../components/navbar/Navbar';
import { RoutesToolbar } from '../../../components/routes/RoutesToolbar';
import { RoutesSummaryCards } from '../../../components/routes/RoutesSummaryCards';
import { RoutesTable } from '../../../components/routes/RoutesTable';
import { useThresholds } from '../../../context/ThresholdContext';
import { useProject } from '../../../context/ProjectContext';
import { fetchRoutes } from '../../../lib/api';
import { RouteMetric } from '../../../types';

function RoutesView() {
  const { thresholds } = useThresholds();
  const { currentProject } = useProject();

  // Timeframe & Filter State
  const [timeframe, setTimeframe] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        return localStorage.getItem('easymetrics_timeframe') || '7d';
      } catch { }
    }
    return '7d';
  });
  const [customRange, setCustomRange] = useState<{ startDate: string; endDate: string } | null>(null);
  const [intervalMs, setIntervalMs] = useState<number | null>(10000); // 10s auto-refresh
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);

  // Routes Data
  const [routes, setRoutes] = useState<RouteMetric[]>([]);

  // Fetch routes metrics
  const loadData = useCallback(
    async (isBackground = false) => {
      if (!isBackground) setLoading(true);
      setIsRefreshing(true);

      const targetProjectId = currentProject.id !== 'default' ? currentProject.id : undefined;

      try {
        const data = await fetchRoutes({
          timeframe,
          projectId: targetProjectId,
          startDate: timeframe === 'custom' ? customRange?.startDate : undefined,
          endDate: timeframe === 'custom' ? customRange?.endDate : undefined,
        });

        setRoutes(data);
        setLastRefreshed(new Date());
      } catch (err) {
        console.error('Failed to load route metrics:', err);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [timeframe, customRange, currentProject.id]
  );

  // Re-fetch on filter, project, or timeframe change
  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // Reset custom range when project changes
  useEffect(() => {
    setCustomRange(null);
  }, [currentProject.id]);

  // Auto-refresh interval
  useEffect(() => {
    if (!intervalMs) return;
    const timer = setInterval(() => {
      loadData(true);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, loadData]);

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

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors">
      {/* 1. Global Navigation Bar */}
      <Navbar />

      {/* 2. Main Page Content */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 flex-1">
        {/* Page Toolbar (Title, Telemetry badge, Latency tiers, Refresh, Timeframe) */}
        <RoutesToolbar
          timeframe={timeframe}
          onTimeframeChange={handleTimeframeChange}
          onCustomRangeApply={handleCustomRangeApply}
          onRefresh={() => loadData(true)}
          isRefreshing={isRefreshing}
          lastRefreshed={lastRefreshed}
          intervalMs={intervalMs}
          onIntervalChange={setIntervalMs}
        />

        {/* Loading Skeletons */}
        {loading && routes.length === 0 ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-28 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 animate-pulse p-4"
                />
              ))}
            </div>
            <div className="h-96 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 animate-pulse" />
          </div>
        ) : (
          <>
            {/* 3. Summary KPI Cards */}
            <RoutesSummaryCards routes={routes} thresholds={thresholds} />

            {/* 4. Interactive Routes Explorer Table */}
            <RoutesTable routes={routes} thresholds={thresholds} />
          </>
        )}
      </main>
    </div>
  );
}

export default function RoutesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center text-sm">
          Loading Routes Explorer...
        </div>
      }
    >
      <RoutesView />
    </Suspense>
  );
}
