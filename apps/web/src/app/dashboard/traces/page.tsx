'use client';

import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Navbar } from '../../../components/navbar/Navbar';
import { TracesToolbar } from '../../../components/traces/TracesToolbar';
import { TracesFilterBar } from '../../../components/traces/TracesFilterBar';
import { TracesTable } from '../../../components/traces/TracesTable';
import { useThresholds } from '../../../context/ThresholdContext';
import { useProject } from '../../../context/ProjectContext';
import { fetchTraces } from '../../../lib/api';
import { Trace } from '../../../types';

function TracesView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRouteParam = searchParams.get('route') || '';

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

  // Table Filters State
  const [searchRoute, setSearchRoute] = useState<string>(initialRouteParam);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [minDurationMs, setMinDurationMs] = useState<number | undefined>(undefined);
  const [page, setPage] = useState(1);

  // Traces Data State
  const [traces, setTraces] = useState<Trace[]>([]);
  const [totalTraces, setTotalTraces] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Sync initial query param if it changes
  useEffect(() => {
    if (initialRouteParam && initialRouteParam !== searchRoute) {
      setSearchRoute(initialRouteParam);
    }
  }, [initialRouteParam]);

  // Track previous project ID to only reset filters when user genuinely switches projects
  const prevProjectIdRef = useRef(currentProject.id);

  useEffect(() => {
    const hasProjectChanged = prevProjectIdRef.current !== currentProject.id;
    const isHydratingFromDefault = prevProjectIdRef.current === 'default';

    if (hasProjectChanged && !isHydratingFromDefault) {
      setSearchRoute('');
      setStatusFilter('all');
      setMinDurationMs(undefined);
      setCustomRange(null);
      setPage(1);
      if (initialRouteParam) {
        router.replace('/dashboard/traces');
      }
    }
    prevProjectIdRef.current = currentProject.id;
  }, [currentProject.id, initialRouteParam, router]);

  // Fetch traces
  const loadData = useCallback(
    async (isBackground = false) => {
      if (!isBackground) setLoading(true);
      setIsRefreshing(true);

      const targetProjectId = currentProject.id !== 'default' ? currentProject.id : undefined;

      try {
        const res = await fetchTraces({
          route: searchRoute || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          minDurationMs,
          timeframe,
          startDate: timeframe === 'custom' ? customRange?.startDate : undefined,
          endDate: timeframe === 'custom' ? customRange?.endDate : undefined,
          page,
          limit: 25,
          projectId: targetProjectId,
        });

        setTraces(res.traces);
        setTotalTraces(res.total);
        setTotalPages(res.totalPages || Math.ceil(res.total / 25) || 1);
        setLastRefreshed(new Date());
      } catch (err) {
        console.error('Failed to load traces:', err);
      } finally {
        setLoading(false);
        setIsRefreshing(false);
      }
    },
    [searchRoute, statusFilter, minDurationMs, timeframe, customRange, page, currentProject.id]
  );

  // Trigger data fetch
  useEffect(() => {
    loadData(false);
  }, [loadData]);

  // Auto-refresh interval
  useEffect(() => {
    if (!intervalMs) return;
    const timer = setInterval(() => {
      loadData(true);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, loadData]);

  // Reset page when filters change
  const handleSearchChange = (val: string) => {
    setSearchRoute(val);
    setPage(1);
  };

  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
    setPage(1);
  };

  const handleMinDurationChange = (duration: number | undefined) => {
    setMinDurationMs(duration);
    setPage(1);
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
    setPage(1);
  };

  // Handle custom timeframe apply -> overwrites previous custom range
  const handleCustomRangeApply = (startDate: string, endDate: string) => {
    setCustomRange({ startDate, endDate });
    setTimeframe('custom');
    try {
      localStorage.setItem('easymetrics_timeframe', 'custom');
    } catch { }
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors">
      {/* 1. Global Navigation Bar */}
      <Navbar />

      {/* 2. Main Page Content */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 flex-1">
        {/* Page Toolbar (Title, Distributed Spans badge, Latency tiers, Refresh, Timeframe) */}
        <TracesToolbar
          timeframe={timeframe}
          onTimeframeChange={handleTimeframeChange}
          onCustomRangeApply={handleCustomRangeApply}
          onRefresh={() => loadData(true)}
          isRefreshing={isRefreshing}
          lastRefreshed={lastRefreshed}
          intervalMs={intervalMs}
          onIntervalChange={setIntervalMs}
        />

        {/* 3. Traces Search & Filter Bar */}
        <TracesFilterBar
          searchRoute={searchRoute}
          onSearchChange={handleSearchChange}
          statusFilter={statusFilter}
          onStatusChange={handleStatusChange}
          minDurationMs={minDurationMs}
          onMinDurationChange={handleMinDurationChange}
          totalTraces={totalTraces}
        />

        {/* 4. Traces Table / Skeleton */}
        {loading && traces.length === 0 ? (
          <div className="h-96 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 animate-pulse" />
        ) : (
          <TracesTable
            traces={traces}
            thresholds={thresholds}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        )}
      </main>
    </div>
  );
}

export default function TracesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center text-sm">
          Loading Traces Explorer...
        </div>
      }
    >
      <TracesView />
    </Suspense>
  );
}
