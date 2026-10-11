/**
 * Dynamic URL Resolution for EasyMetrics Web Dashboard
 * Resolves API and AI Agent endpoints seamlessly across local development,
 * custom domains, and Azure IP/DNS deployments.
 */

export function getApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (envUrl && envUrl !== 'http://localhost:4000' && envUrl !== 'http://127.0.0.1:4000') {
    return envUrl.replace(/\/+$/, '');
  }

  // Dynamic browser fallback for cloud VMs / remote hosts
  if (
    typeof window !== 'undefined' &&
    window.location.hostname &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    return `${window.location.protocol}//${window.location.hostname}:4000`;
  }

  return (envUrl || 'http://localhost:4000').replace(/\/+$/, '');
}

export function getAgentBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_AGENT_URL?.trim();
  if (envUrl && envUrl !== 'http://localhost:8000' && envUrl !== 'http://127.0.0.1:8000') {
    return envUrl.replace(/\/+$/, '');
  }

  // Dynamic browser fallback for cloud VMs / remote hosts
  if (
    typeof window !== 'undefined' &&
    window.location.hostname &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1'
  ) {
    return `${window.location.protocol}//${window.location.hostname}:8000`;
  }

  return (envUrl || 'http://localhost:8000').replace(/\/+$/, '');
}

