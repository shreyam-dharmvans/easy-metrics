import { OverviewMetrics, RouteMetric, Trace, Span } from '../types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

async function fetchWithAuth<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const isDemo =
    typeof window !== 'undefined' &&
    (sessionStorage.getItem('easymetrics_is_demo') === 'true' ||
      localStorage.getItem('easymetrics_is_demo') === 'true' ||
      new URLSearchParams(window.location.search).get('demo') === 'true' ||
      document.cookie.includes('easymetrics_is_demo=true'));

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(isDemo ? { 'x-easymetrics-demo': 'true' } : {}),
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Automatically passes HttpOnly session cookies
  });

  if (!res.ok) {
    const errorBody = await res.text().catch(() => '');
    throw new Error(`API error ${res.status} on ${endpoint}: ${errorBody}`);
  }
  return res.json();
}

export async function fetchOverview(params: {
  timeframe?: string;
  route?: string;
  fast?: number;
  slow?: number;
  startDate?: string;
  endDate?: string;
  projectId?: string;
}): Promise<OverviewMetrics> {
  const query = new URLSearchParams();
  if (params.timeframe) query.set('timeframe', params.timeframe);
  if (params.route && params.route !== 'all') query.set('route', params.route);
  if (params.fast) query.set('fast', params.fast.toString());
  if (params.slow) query.set('slow', params.slow.toString());
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);
  if (params.projectId) query.set('projectId', params.projectId);

  const qs = query.toString();
  return fetchWithAuth<OverviewMetrics>(`/metrics/overview${qs ? `?${qs}` : ''}`);
}

export async function fetchRoutes(
  paramsOrTimeframe:
    | string
    | {
      timeframe?: string;
      projectId?: string;
      startDate?: string;
      endDate?: string;
    } = '1h',
  legacyProjectId?: string
): Promise<RouteMetric[]> {
  const query = new URLSearchParams();
  if (typeof paramsOrTimeframe === 'string') {
    query.set('timeframe', paramsOrTimeframe);
    if (legacyProjectId) query.set('projectId', legacyProjectId);
  } else {
    if (paramsOrTimeframe.timeframe) query.set('timeframe', paramsOrTimeframe.timeframe);
    if (paramsOrTimeframe.projectId) query.set('projectId', paramsOrTimeframe.projectId);
    if (paramsOrTimeframe.startDate) query.set('startDate', paramsOrTimeframe.startDate);
    if (paramsOrTimeframe.endDate) query.set('endDate', paramsOrTimeframe.endDate);
  }
  return fetchWithAuth<RouteMetric[]>(`/metrics/routes?${query.toString()}`);
}

export async function fetchTraces(params: {
  route?: string;
  status?: string;
  minDurationMs?: number;
  timeframe?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
  projectId?: string;
}): Promise<{ total: number; page: number; limit: number; totalPages?: number; traces: Trace[] }> {
  const query = new URLSearchParams();
  if (params.route) query.set('route', params.route);
  if (params.status && params.status !== 'all') query.set('status', params.status);
  if (params.minDurationMs) query.set('minDurationMs', params.minDurationMs.toString());
  if (params.timeframe) query.set('timeframe', params.timeframe);
  if (params.startDate) query.set('startDate', params.startDate);
  if (params.endDate) query.set('endDate', params.endDate);
  if (params.page) query.set('page', params.page.toString());
  if (params.limit) query.set('limit', params.limit.toString());
  if (params.projectId) query.set('projectId', params.projectId);

  const qs = query.toString();
  return fetchWithAuth<{ total: number; page: number; limit: number; totalPages?: number; traces: Trace[] }>(
    `/metrics/traces${qs ? `?${qs}` : ''}`
  );
}

export async function fetchTraceWaterfall(
  traceId: string,
  projectId?: string
): Promise<{ trace: Trace; spans: Span[] }> {
  const query = new URLSearchParams();
  if (projectId) query.set('projectId', projectId);
  const qs = query.toString();
  return fetchWithAuth<{ trace: Trace; spans: Span[] }>(`/metrics/traces/${traceId}${qs ? `?${qs}` : ''}`);
}

// ============================================================================
// PROJECT & API KEY CLIENT CALLS
// ============================================================================

export async function fetchProjects(): Promise<
  Array<{
    id: string;
    name: string;
    slug: string;
    ownerId?: string;
    createdAt: string;
    _count: { apiKeys: number; traces: number };
  }>
> {
  return fetchWithAuth('/projects');
}

export async function fetchCurrentProject(): Promise<{
  id: string;
  name: string;
  slug: string;
  apiKeys: Array<{
    id: string;
    name: string;
    key: string;
    lastUsedAt: string | null;
    createdAt: string;
  }>;
}> {
  return fetchWithAuth('/projects/current');
}

function assertNotDemo(actionName: string) {
  const isDemo =
    typeof window !== 'undefined' &&
    (sessionStorage.getItem('easymetrics_is_demo') === 'true' ||
      localStorage.getItem('easymetrics_is_demo') === 'true' ||
      new URLSearchParams(window.location.search).get('demo') === 'true' ||
      document.cookie.includes('easymetrics_is_demo=true'));
  if (isDemo) {
    throw new Error(`${actionName} is disabled in read-only Demo Mode. Please sign in with Google.`);
  }
}

export async function createProjectApi(name: string) {
  assertNotDemo('Project creation');
  return fetchWithAuth<{
    project: { id: string; name: string; slug: string };
    apiKey: { id: string; name: string; key: string };
  }>('/projects', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function renameProjectApi(id: string, name: string) {
  assertNotDemo('Project renaming');
  return fetchWithAuth(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name }),
  });
}

export async function createApiKeyApi(name: string, projectId?: string) {
  assertNotDemo('API key generation');
  return fetchWithAuth<{ id: string; name: string; key: string }>('/projects/api-keys', {
    method: 'POST',
    body: JSON.stringify({ name, projectId }),
  });
}

export async function deleteApiKeyApi(id: string) {
  assertNotDemo('API key deletion');
  return fetchWithAuth<{ success: boolean; message: string }>(`/projects/api-keys/${id}`, {
    method: 'DELETE',
  });
}

export async function deleteProjectApi(id: string) {
  assertNotDemo('Project deletion');
  return fetchWithAuth<{ success: boolean; message: string }>(`/projects/${id}`, {
    method: 'DELETE',
  });
}
