'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  fetchProjects,
  createProjectApi,
  renameProjectApi,
  deleteProjectApi,
} from '../lib/api';

export interface ProjectItem {
  id: string;
  name: string;
  slug: string;
  ownerId?: string;
  createdAt?: string;
  _count?: { apiKeys: number; traces: number };
}

interface ProjectContextType {
  projects: ProjectItem[];
  currentProject: ProjectItem;
  isLoading: boolean;
  isDemo: boolean;
  switchProject: (projectId: string) => void;
  refreshProjects: () => Promise<void>;
  createProject: (name: string) => Promise<{ project: ProjectItem; apiKey: any }>;
  renameProject: (id: string, name: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
}

const DEFAULT_PROJECT: ProjectItem = {
  id: 'default',
  name: 'Demo Web App',
  slug: 'demo-web-app',
};

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

/**
 * Checks all storage and query signals to determine if the user is in Demo Mode
 */
export function checkIsDemoMode(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('demo') === 'true') return true;
    if (sessionStorage.getItem('easymetrics_is_demo') === 'true') return true;
    if (localStorage.getItem('easymetrics_is_demo') === 'true') return true;
    if (document.cookie.includes('easymetrics_is_demo=true')) return true;
  } catch { }
  return false;
}

/**
 * Sets or clears demo mode markers across all storage channels
 */
export function setDemoModeStorage(active: boolean) {
  if (typeof window === 'undefined') return;
  try {
    if (active) {
      sessionStorage.setItem('easymetrics_is_demo', 'true');
      localStorage.setItem('easymetrics_is_demo', 'true');
      document.cookie = 'easymetrics_is_demo=true; path=/; max-age=604800; SameSite=Lax';
    } else {
      sessionStorage.removeItem('easymetrics_is_demo');
      localStorage.removeItem('easymetrics_is_demo');
      document.cookie = 'easymetrics_is_demo=; path=/; max-age=0; SameSite=Lax';
    }
  } catch { }
}

/**
 * Clears any filters or project-specific caches stored in localStorage
 */
export function clearProjectSpecificStorage(projectId?: string) {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (
        key.startsWith('em_filter_') ||
        key.startsWith('em_route_') ||
        key.startsWith('easymetrics_filter_') ||
        (projectId && key.includes(projectId))
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (err) {
    console.error('Error clearing project-specific storage:', err);
  }
}

/**
 * Cleans up all EasyMetrics storage on sign out or demo exit
 */
export function clearAllEasyMetricsStorage() {
  if (typeof window === 'undefined') return;
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith('em_') || key.startsWith('easymetrics_')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
    setDemoModeStorage(false);
  } catch (err) {
    console.error('Error clearing EasyMetrics storage:', err);
  }
}

/**
 * Initiates Google OAuth while ensuring all demo session markers are completely wiped.
 */
export function initiateGoogleSignIn() {
  clearAllEasyMetricsStorage();
  const rawBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000').replace(/\/+$/, '');
  const authUrl = `${rawBase}/api/v1/auth/google`;
  window.location.href = authUrl;
}

function DemoRouteWatcher({ onSync }: { onSync: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    onSync();
  }, [pathname, searchParams, onSync]);

  return null;
}

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [currentProject, setCurrentProject] = useState<ProjectItem>(DEFAULT_PROJECT);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemo, setIsDemo] = useState(false);

  const refreshProjects = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await fetchProjects();
      setProjects(data);

      if (data.length > 0) {
        if (typeof window !== 'undefined' && data[0].ownerId) {
          localStorage.setItem('easymetrics_user_id', data[0].ownerId);
        }

        const savedId = typeof window !== 'undefined' ? localStorage.getItem('em_project_id') : null;
        const matched = data.find((p) => p.id === savedId) || data[0];

        setCurrentProject(matched);
        if (typeof window !== 'undefined') {
          localStorage.setItem('em_project_id', matched.id);
        }
      }
    } catch (err) {
      console.error('Failed to load projects in ProjectProvider:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const syncDemoState = useCallback(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('auth') === 'success') {
        clearAllEasyMetricsStorage();
        setIsDemo(false);
        params.delete('auth');
        const clean = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
        window.history.replaceState(null, '', clean);
        refreshProjects();
        return;
      }
    }
    const active = checkIsDemoMode();
    setIsDemo(active);
    if (active) {
      setDemoModeStorage(true);
    }
  }, [refreshProjects]);

  useEffect(() => {
    syncDemoState();
    window.addEventListener('popstate', syncDemoState);
    window.addEventListener('storage', syncDemoState);
    return () => {
      window.removeEventListener('popstate', syncDemoState);
      window.removeEventListener('storage', syncDemoState);
    };
  }, [syncDemoState]);

  useEffect(() => {
    refreshProjects();
  }, [refreshProjects]);

  const switchProject = useCallback(
    (projectId: string) => {
      const target = projects.find((p) => p.id === projectId);
      if (target) {
        // 1. Clear project-specific filters from localStorage
        clearProjectSpecificStorage(currentProject.id);

        // 2. Remove query filter parameters if on a filtered page, but preserve ?demo=true if in demo mode
        if (typeof window !== 'undefined' && window.location.search) {
          const isDemoActive = isDemo || checkIsDemoMode();
          const cleanPath = isDemoActive ? `${window.location.pathname}?demo=true` : window.location.pathname;
          window.history.replaceState(null, '', cleanPath);
        }

        // 3. Set new active project
        setCurrentProject(target);
        if (typeof window !== 'undefined') {
          localStorage.setItem('em_project_id', target.id);
          if (target.ownerId) {
            localStorage.setItem('easymetrics_user_id', target.ownerId);
          }
        }
      }
    },
    [projects, currentProject.id, isDemo]
  );

  const createProject = useCallback(
    async (name: string) => {
      if (isDemo || checkIsDemoMode()) {
        throw new Error('Project creation is disabled in read-only Demo Mode.');
      }
      const res = await createProjectApi(name);
      await refreshProjects();
      if (res?.project) {
        switchProject(res.project.id);
      }
      return res;
    },
    [isDemo, refreshProjects, switchProject]
  );

  const renameProject = useCallback(
    async (id: string, name: string) => {
      if (isDemo || checkIsDemoMode()) {
        throw new Error('Project renaming is disabled in read-only Demo Mode.');
      }
      await renameProjectApi(id, name);
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, name: name.trim() } : p))
      );
      if (currentProject.id === id) {
        setCurrentProject((prev) => ({ ...prev, name: name.trim() }));
      }
    },
    [isDemo, currentProject.id]
  );

  const deleteProject = useCallback(
    async (id: string) => {
      if (isDemo || checkIsDemoMode()) {
        throw new Error('Project deletion is disabled in read-only Demo Mode.');
      }
      clearProjectSpecificStorage(id);
      await deleteProjectApi(id);
      const remaining = projects.filter((p) => p.id !== id);
      setProjects(remaining);

      if (currentProject.id === id && remaining.length > 0) {
        setCurrentProject(remaining[0]);
        if (typeof window !== 'undefined') {
          localStorage.setItem('em_project_id', remaining[0].id);
        }
      }
    },
    [isDemo, projects, currentProject.id]
  );

  return (
    <ProjectContext.Provider
      value={{
        projects,
        currentProject,
        isLoading,
        isDemo,
        switchProject,
        refreshProjects,
        createProject,
        renameProject,
        deleteProject,
      }}
    >
      <Suspense fallback={null}>
        <DemoRouteWatcher onSync={syncDemoState} />
      </Suspense>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return ctx;
}
