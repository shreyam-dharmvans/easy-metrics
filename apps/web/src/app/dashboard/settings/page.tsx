'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  FolderKanban,
  KeyRound,
  Code2,
  SlidersHorizontal,
  Plus,
  Trash2,
  Edit3,
  Copy,
  Check,
  Eye,
  EyeOff,
  ArrowRightLeft,
  LogOut,
  Clock,
  Terminal,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Info,
  ShieldAlert,
} from 'lucide-react';
import { Navbar } from '../../../components/navbar/Navbar';
import { useProject, clearAllEasyMetricsStorage, initiateGoogleSignIn } from '../../../context/ProjectContext';
import { useThresholds } from '../../../context/ThresholdContext';
import {
  fetchCurrentProject,
  createApiKeyApi,
  deleteApiKeyApi,
} from '../../../lib/api';

function SettingsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryTab = searchParams.get('tab');

  const {
    projects,
    currentProject,
    isDemo,
    switchProject,
    createProject,
    renameProject,
    deleteProject,
    refreshProjects,
  } = useProject();

  const { thresholds, updateThresholds, resetThresholds } = useThresholds();

  // Active tab state
  const [activeTab, setActiveTab] = useState<'projects' | 'apikeys' | 'sdk' | 'thresholds'>('projects');

  // Sync tab with URL query parameter
  useEffect(() => {
    if (queryTab && ['projects', 'apikeys', 'sdk', 'thresholds'].includes(queryTab)) {
      setActiveTab(queryTab as any);
    }
  }, [queryTab]);

  // Handle tab switch and keep URL in sync cleanly
  const handleTabChange = (tab: 'projects' | 'apikeys' | 'sdk' | 'thresholds') => {
    setActiveTab(tab);
    router.replace(`/dashboard/settings?tab=${tab}${isDemo ? '&demo=true' : ''}`);
  };

  // API Keys state for active project
  const [apiKeys, setApiKeys] = useState<
    Array<{
      id: string;
      name: string;
      key: string;
      lastUsedAt: string | null;
      createdAt: string;
    }>
  >([]);
  const [keysLoading, setKeysLoading] = useState(false);

  // Modals & form state
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [renamedName, setRenamedName] = useState('');

  const [isNewKeyModalOpen, setIsNewKeyModalOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [isCreatingKey, setIsCreatingKey] = useState(false);

  // Copy feedback state
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [visibleKeyIds, setVisibleKeyIds] = useState<Record<string, boolean>>({});

  // Threshold local form state
  const [fastMs, setFastMs] = useState(thresholds.fastMs);
  const [slowMs, setSlowMs] = useState(thresholds.slowMs);
  const [bottleneckPercent, setBottleneckPercent] = useState(thresholds.bottleneckPercent);
  const [thresholdSavedNotice, setThresholdSavedNotice] = useState(false);

  // Sync threshold state
  useEffect(() => {
    setFastMs(thresholds.fastMs);
    setSlowMs(thresholds.slowMs);
    setBottleneckPercent(thresholds.bottleneckPercent);
  }, [thresholds]);

  // Load API keys for currently selected project
  const loadApiKeys = useCallback(async (explicitProjectId?: string) => {
    const targetId = explicitProjectId || currentProject?.id;
    if (!targetId || targetId === 'default') return;
    try {
      setKeysLoading(true);
      const data = await fetchCurrentProject(targetId);
      if (data?.apiKeys) {
        setApiKeys(data.apiKeys);
      }
    } catch (err) {
      console.error('Failed to load project API keys:', err);
    } finally {
      setKeysLoading(false);
    }
  }, [currentProject?.id]);

  useEffect(() => {
    loadApiKeys();
  }, [loadApiKeys]);

  // Project Actions
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDemo) {
      alert('Project creation is disabled in read-only Demo Mode. Please sign in with Google to create your own projects.');
      return;
    }
    if (!newProjectName.trim() || isCreatingProject) return;
    try {
      setIsCreatingProject(true);
      await createProject(newProjectName.trim());
      setNewProjectName('');
      setIsNewProjectModalOpen(false);
    } catch (err) {
      alert('Failed to create project: ' + (err as any).message);
    } finally {
      setIsCreatingProject(false);
    }
  };

  const handleRenameProject = async (id: string) => {
    if (isDemo) {
      alert('Project renaming is disabled in read-only Demo Mode.');
      return;
    }
    if (!renamedName.trim()) return;
    try {
      await renameProject(id, renamedName.trim());
      setRenamingProjectId(null);
      setRenamedName('');
    } catch (err) {
      alert('Failed to rename project: ' + (err as any).message);
    }
  };

  const handleDeleteProject = async (id: string, name: string) => {
    if (isDemo) {
      alert('Project deletion is disabled in read-only Demo Mode.');
      return;
    }
    if (projects.length <= 1) {
      alert('You cannot delete your only project. You must have at least one active project.');
      return;
    }
    const confirmed = confirm(
      `Are you sure you want to permanently delete project "${name}"?\nAll associated traces, spans, and API keys will be wiped.`
    );
    if (!confirmed) return;
    try {
      await deleteProject(id);
    } catch (err) {
      alert('Failed to delete project: ' + (err as any).message);
    }
  };

  // API Key Actions
  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isDemo) {
      alert('API key generation is disabled in read-only Demo Mode. Please sign in with Google.');
      return;
    }
    if (!newKeyName.trim() || isCreatingKey) return;
    try {
      setIsCreatingKey(true);
      const res = await createApiKeyApi(newKeyName.trim(), currentProject.id);
      if (res) {
        await loadApiKeys(currentProject.id);
        await refreshProjects();
        setNewKeyName('');
        setIsNewKeyModalOpen(false);
      }
    } catch (err) {
      alert('Failed to create API key: ' + (err as any).message);
    } finally {
      setIsCreatingKey(false);
    }
  };

  const handleDeleteApiKey = async (id: string, name: string) => {
    if (isDemo) {
      alert('API key revocation is disabled in read-only Demo Mode.');
      return;
    }
    const confirmed = confirm(`Are you sure you want to revoke API key "${name}"?\nAny services sending traces with this key will be rejected.`);
    if (!confirmed) return;
    try {
      await deleteApiKeyApi(id);
      await loadApiKeys(currentProject.id);
      await refreshProjects();
    } catch (err) {
      alert('Failed to delete API key: ' + (err as any).message);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    if (isDemo) {
      alert('Live API keys are masked in Demo Mode. Please sign in with Google to create your own production keys.');
      return;
    }
    navigator.clipboard.writeText(text);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const toggleKeyVisibility = (id: string) => {
    if (isDemo) {
      alert('API keys are masked in read-only Demo Mode.');
      return;
    }
    setVisibleKeyIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Save Thresholds
  const handleSaveThresholds = () => {
    const updated = {
      fastMs: Number(fastMs) || 150,
      slowMs: Number(slowMs) || 500,
      bottleneckPercent: Number(bottleneckPercent) || 40,
    };
    updateThresholds(updated);
    setThresholdSavedNotice(true);
    setTimeout(() => setThresholdSavedNotice(false), 2500);
  };

  const handleResetThresholds = () => {
    resetThresholds();
    setFastMs(150);
    setSlowMs(500);
    setBottleneckPercent(40);
    setThresholdSavedNotice(true);
    setTimeout(() => setThresholdSavedNotice(false), 2500);
  };

  // Sign out
  const handleSignOut = () => {
    clearAllEasyMetricsStorage();
    router.push('/');
  };

  const activeApiKeyStr = isDemo ? 'em_live_••••••••••••••••••••••••••••' : (apiKeys.length > 0 ? apiKeys[0].key : 'em_live_your_api_key_here');

  const snippetCode = `// 1. Install SDK in your Node.js application
npm install @easy-metrics/node

// 2. Initialize at the VERY TOP of your entrypoint (server.js / index.ts)
import { init } from '@easy-metrics/node';

init({
  apiKey: process.env.EASY_METRICS_KEY || '${activeApiKeyStr}',
  serviceName: '${currentProject?.slug || 'my-node-service'}',
});

// Your existing Express, database, and HTTP code runs untouched!`;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 flex flex-col font-sans transition-colors">
      <Navbar />

      <main className="max-w-5xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 flex-1 space-y-6">
        {/* Demo Mode Notice Banner */}
        {isDemo && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
            <div className="flex items-center gap-2.5">
              <ShieldAlert className="w-5 h-5 text-amber-500 shrink-0" />
              <div className="text-xs leading-relaxed">
                <span className="font-bold text-amber-900 dark:text-amber-100">Live Demo Mode (Read-Only):</span>{' '}
                Project creation, deletion, renaming, and API key generation or revocation are strictly disabled. Sign in with Google to create and manage your own production projects.
              </div>
            </div>
            <button
              onClick={initiateGoogleSignIn}
              type="button"
              className="shrink-0 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-colors self-start sm:self-auto text-center cursor-pointer"
            >
              Sign In with Google
            </button>
          </div>
        )}

        {/* Header Section */}
        <div className="border-b border-zinc-200/80 dark:border-zinc-800/80 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-950 dark:text-white">
                Workspace Settings
              </h1>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                Configure telemetry ingestion, manage projects, and customize performance thresholds.
              </p>
            </div>

            {/* Active Project Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/90 text-xs font-semibold shadow-2xs self-start sm:self-auto">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-zinc-500 dark:text-zinc-400 font-normal">Active:</span>
              <span className="text-zinc-900 dark:text-white font-bold truncate max-w-[160px]">
                {currentProject.name}
              </span>
            </div>
          </div>

          {/* Segmented Tab Navigation */}
          <div className="mt-6">
            <div className="inline-flex items-center gap-1 p-1 bg-zinc-200/60 dark:bg-zinc-900 rounded-xl border border-zinc-300/60 dark:border-zinc-800/80 text-xs font-medium">
              <button
                type="button"
                onClick={() => handleTabChange('projects')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'projects'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                  }`}
              >
                <FolderKanban className="w-3.5 h-3.5 text-zinc-400" />
                <span>Projects</span>
                <span className="px-1.5 py-0.2 rounded-full bg-zinc-100 dark:bg-zinc-700/80 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300">
                  {projects.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('apikeys')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'apikeys'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                  }`}
              >
                <KeyRound className="w-3.5 h-3.5 text-zinc-400" />
                <span>API Keys</span>
                <span className="px-1.5 py-0.2 rounded-full bg-zinc-100 dark:bg-zinc-700/80 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300">
                  {apiKeys.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('sdk')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'sdk'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                  }`}
              >
                <Code2 className="w-3.5 h-3.5 text-zinc-400" />
                <span>SDK Quickstart</span>
              </button>

              <button
                type="button"
                onClick={() => handleTabChange('thresholds')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${activeTab === 'thresholds'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs font-semibold'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
                  }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-zinc-400" />
                <span>Thresholds</span>
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: PROJECTS MANAGEMENT                                                */}
        {/* ========================================================================= */}
        {activeTab === 'projects' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-zinc-950 dark:text-white">Your Projects</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Isolate runtime telemetry, API keys, and error traces between different microservices.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (isDemo) {
                    alert('Project creation is disabled in read-only Demo Mode. Please sign in with Google.');
                    return;
                  }
                  setIsNewProjectModalOpen(true);
                }}
                disabled={isDemo}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors shadow-2xs flex items-center gap-1.5 ${isDemo
                  ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'
                  }`}
                title={isDemo ? 'Disabled in Demo Mode' : 'Create New Project'}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create New Project</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {projects.map((proj) => {
                const isActive = proj.id === currentProject.id;
                const isRenaming = renamingProjectId === proj.id;

                return (
                  <div
                    key={proj.id}
                    className={`p-5 rounded-2xl border transition-all bg-white dark:bg-zinc-900/90 flex flex-col justify-between ${isActive
                      ? 'border-emerald-500/60 dark:border-emerald-500/50 ring-1 ring-emerald-500/20 bg-emerald-500/[0.02] dark:bg-emerald-500/[0.03] shadow-xs'
                      : 'border-zinc-200/90 dark:border-zinc-800/90 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-2xs'
                      }`}
                  >
                    <div>
                      {/* Top Header */}
                      <div className="flex items-start justify-between gap-3 mb-2.5">
                        {isRenaming ? (
                          <div className="flex items-center gap-2 w-full">
                            <input
                              type="text"
                              value={renamedName}
                              onChange={(e) => setRenamedName(e.target.value)}
                              className="px-2.5 py-1 text-xs border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white w-full focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleRenameProject(proj.id)}
                              className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-lg font-semibold cursor-pointer"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setRenamingProjectId(null)}
                              className="px-2 py-1 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs rounded-lg cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isActive
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                                }`}>
                                <FolderKanban className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-bold text-sm text-zinc-950 dark:text-white truncate">
                                  {proj.name}
                                </h3>
                                <div className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 truncate mt-0.5">
                                  slug: {proj.slug}
                                </div>
                              </div>
                            </div>

                            {/* Active pill or Switch button */}
                            {isActive ? (
                              <span className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300/80 dark:border-emerald-800 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 shadow-2xs">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Active
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => switchProject(proj.id)}
                                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                              >
                                <ArrowRightLeft className="w-3 h-3 text-zinc-400" />
                                <span>Switch</span>
                              </button>
                            )}
                          </>
                        )}
                      </div>

                      {/* Stats Badges */}
                      <div className="flex items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400 pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
                        <div className="inline-flex items-center gap-1.5 bg-zinc-100/70 dark:bg-zinc-800/50 px-2 py-0.5 rounded-md text-[11px]">
                          <span className="font-bold text-zinc-900 dark:text-white">{proj._count?.traces ?? 0}</span>
                          <span className="text-zinc-500">traces</span>
                        </div>
                        <div className="inline-flex items-center gap-1.5 bg-zinc-100/70 dark:bg-zinc-800/50 px-2 py-0.5 rounded-md text-[11px]">
                          <span className="font-bold text-zinc-900 dark:text-white">{proj._count?.apiKeys ?? 0}</span>
                          <span className="text-zinc-500">keys</span>
                        </div>
                      </div>
                    </div>

                    {/* Card Actions Footer */}
                    <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800/80 pt-3 mt-4 text-xs">
                      {isDemo ? (
                        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 dark:text-zinc-500 italic py-0.5">
                          <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
                          <span>Modifications disabled in Demo Mode</span>
                        </div>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setRenamingProjectId(proj.id);
                              setRenamedName(proj.name);
                            }}
                            className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer font-medium"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Rename</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteProject(proj.id, proj.name)}
                            className="inline-flex items-center gap-1 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors cursor-pointer font-medium"
                            title="Delete this project"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Delete</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: API KEYS MANAGEMENT                                                */}
        {/* ========================================================================= */}
        {activeTab === 'apikeys' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-zinc-950 dark:text-white">API Keys</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Secret keys used by the <code className="text-indigo-600 dark:text-indigo-400 font-mono">@easy-metrics/node</code> SDK to authenticate ingestion.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (isDemo) {
                    alert('API key generation is disabled in read-only Demo Mode. Please sign in with Google.');
                    return;
                  }
                  setIsNewKeyModalOpen(true);
                }}
                disabled={isDemo}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors shadow-2xs flex items-center gap-1.5 self-start sm:self-auto ${isDemo
                  ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'
                  }`}
                title={isDemo ? 'Disabled in Demo Mode' : 'Generate New Key'}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Generate New Key</span>
              </button>
            </div>

            {/* Scoped Project Banner */}
            <div className="flex items-center gap-2 p-3 rounded-xl bg-zinc-100/80 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs">
              <Info className="w-4 h-4 text-indigo-500 shrink-0" />
              <div className="text-zinc-600 dark:text-zinc-400">
                Viewing API keys for active project: <strong className="text-zinc-900 dark:text-white">{currentProject.name}</strong>.
              </div>
            </div>

            {/* Keys List */}
            {keysLoading ? (
              <div className="p-8 text-center text-xs text-zinc-400 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                Loading API keys...
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="p-8 text-center text-xs text-zinc-400 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                No API keys found for this project. Generate one above to start sending metrics.
              </div>
            ) : (
              <div className="space-y-3">
                {apiKeys.map((k) => {
                  const isVisible = visibleKeyIds[k.id] || false;
                  const isCopied = copiedKeyId === k.id;
                  const maskedKey = isDemo
                    ? 'em_live_••••••••••••••••••••••••••••'
                    : (isVisible ? k.key : `${k.key.substring(0, 10)}••••••••••••••••••••••••`);

                  return (
                    <div
                      key={k.id}
                      className="p-4 rounded-xl border border-zinc-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-xs text-zinc-950 dark:text-white">{k.name}</span>
                          <span className="text-[10px] text-zinc-400">
                            Created {new Date(k.createdAt).toLocaleDateString()}
                          </span>
                          {isDemo && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              Demo Key
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 mt-1.5">
                          <code className="text-xs font-mono bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 select-none">
                            {maskedKey}
                          </code>
                          {!isDemo && (
                            <button
                              type="button"
                              onClick={() => toggleKeyVisibility(k.id)}
                              className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer"
                              title={isVisible ? 'Hide key' : 'Reveal key'}
                            >
                              {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                        {k.lastUsedAt && (
                          <div className="hidden lg:flex items-center gap-1 text-[11px] text-zinc-400 mr-2">
                            <Clock className="w-3 h-3 text-zinc-400" />
                            <span>Used {new Date(k.lastUsedAt).toLocaleDateString()}</span>
                          </div>
                        )}

                        {isDemo ? (
                          <span className="text-[11px] text-zinc-400 dark:text-zinc-500 italic px-2 py-1">
                            🔒 Key hidden in demo
                          </span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(k.key, k.id)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${isCopied
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-600 dark:text-emerald-400'
                                : 'border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                                }`}
                            >
                              {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                              <span>{isCopied ? 'Copied!' : 'Copy'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteApiKey(k.id, k.name)}
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                              title="Revoke key"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: SDK QUICKSTART GUIDE                                               */}
        {/* ========================================================================= */}
        {activeTab === 'sdk' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-zinc-950 dark:text-white">SDK Quickstart Guide</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Integrate EasyMetrics into your Node.js backend in under 30 seconds.
              </p>
            </div>

            {/* Terminal Window Code Block */}
            <div className="rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-zinc-950 text-zinc-100 shadow-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded-full bg-rose-500/80" />
                    <span className="w-3 h-3 rounded-full bg-amber-500/80" />
                    <span className="w-3 h-3 rounded-full bg-emerald-500/80" />
                  </div>
                  <span className="text-xs font-mono text-zinc-400 ml-2">Node.js · Express · HTTP</span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(snippetCode);
                    setCopiedSnippet(true);
                    setTimeout(() => setCopiedSnippet(false), 2000);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors cursor-pointer"
                >
                  {copiedSnippet ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 text-zinc-400" />}
                  <span>{copiedSnippet ? 'Copied snippet' : 'Copy code'}</span>
                </button>
              </div>

              <div className="p-4 sm:p-5 font-mono text-xs overflow-x-auto leading-relaxed text-zinc-300">
                <pre>{snippetCode}</pre>
              </div>
            </div>

            {/* Step-by-Step Instructions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-zinc-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-900 space-y-1.5">
                <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center">
                  1
                </div>
                <div className="font-bold text-xs text-zinc-950 dark:text-white">Install Package</div>
                <div className="text-[11px] text-zinc-500">Run npm install @easy-metrics/node inside your application directory.</div>
              </div>

              <div className="p-4 rounded-xl border border-zinc-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-900 space-y-1.5">
                <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center">
                  2
                </div>
                <div className="font-bold text-xs text-zinc-950 dark:text-white">Initialize at Root</div>
                <div className="text-[11px] text-zinc-500">Call init() before any other imports so Express routes and HTTP calls are instrumented.</div>
              </div>

              <div className="p-4 rounded-xl border border-zinc-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-900 space-y-1.5">
                <div className="w-6 h-6 rounded-lg bg-indigo-100 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-bold text-xs flex items-center justify-center">
                  3
                </div>
                <div className="font-bold text-xs text-zinc-950 dark:text-white">Inspect Real Traces</div>
                <div className="text-[11px] text-zinc-500">Telemetry will automatically stream to this dashboard in real-time.</div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: LATENCY THRESHOLDS                                                 */}
        {/* ========================================================================= */}
        {activeTab === 'thresholds' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-zinc-950 dark:text-white">Latency &amp; Performance Thresholds</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Define what your team considers Fast, Acceptable, and Slow across the dashboard and AI diagnostics.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetThresholds}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3 text-zinc-400" />
                  <span>Reset Defaults</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveThresholds}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Save Thresholds</span>
                </button>
              </div>
            </div>

            {thresholdSavedNotice && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 font-semibold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <span>Thresholds updated and applied across all charts &amp; AI tools!</span>
              </div>
            )}

            {/* Threshold Sliders Card */}
            <div className="p-5 rounded-2xl border border-zinc-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-900 space-y-6 shadow-2xs">
              {/* Fast Threshold */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-bold text-zinc-950 dark:text-white">Fast Request Limit</span>
                    <span className="text-[11px] text-zinc-500">(classified as green / optimal)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={fastMs}
                      onChange={(e) => setFastMs(Number(e.target.value))}
                      className="w-20 px-2 py-1 text-xs border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-800 font-mono text-right"
                    />
                    <span className="text-xs text-zinc-400">ms</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="20"
                  max="1000"
                  step="10"
                  value={fastMs}
                  onChange={(e) => setFastMs(Number(e.target.value))}
                  className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>

              {/* Slow Threshold */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                    <span className="text-xs font-bold text-zinc-950 dark:text-white">Slow Request Threshold</span>
                    <span className="text-[11px] text-zinc-500">(classified as degraded / alert)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={slowMs}
                      onChange={(e) => setSlowMs(Number(e.target.value))}
                      className="w-20 px-2 py-1 text-xs border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-800 font-mono text-right"
                    />
                    <span className="text-xs text-zinc-400">ms</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="100"
                  max="5000"
                  step="50"
                  value={slowMs}
                  onChange={(e) => setSlowMs(Number(e.target.value))}
                  className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-rose-500"
                />
              </div>

              {/* Bottleneck Ratio */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    <span className="text-xs font-bold text-zinc-950 dark:text-white">Span Bottleneck Ratio</span>
                    <span className="text-[11px] text-zinc-500">(spans consuming ≥ {bottleneckPercent}% of total trace)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={bottleneckPercent}
                      onChange={(e) => setBottleneckPercent(Number(e.target.value))}
                      className="w-20 px-2 py-1 text-xs border border-zinc-300 dark:border-zinc-700 rounded-lg bg-zinc-50 dark:bg-zinc-800 font-mono text-right"
                    />
                    <span className="text-xs text-zinc-400">%</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="10"
                  max="90"
                  step="5"
                  value={bottleneckPercent}
                  onChange={(e) => setBottleneckPercent(Number(e.target.value))}
                  className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                />
              </div>

              {/* Visual Scale Preview */}
              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 mb-2">
                  Live Classification Scale Preview:
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-semibold">
                    Fast: ≤ {fastMs}ms
                  </span>
                  <span className="text-zinc-400">→</span>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 font-semibold">
                    Acceptable: {fastMs}ms – {slowMs}ms
                  </span>
                  <span className="text-zinc-400">→</span>
                  <span className="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 font-semibold">
                    Degraded: &gt; {slowMs}ms
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* DEVELOPER ACCOUNT & SIGN OUT CARD                                         */}
        {/* ========================================================================= */}
        <div className="p-4 rounded-2xl border border-zinc-200/90 dark:border-zinc-800/90 bg-white dark:bg-zinc-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
          {isDemo ? (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-xs flex items-center justify-center border border-amber-500/30">
                DM
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-950 dark:text-white">Demo Visitor Session</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium">Read-Only</span>
                </div>
                <div className="text-[11px] font-mono text-zinc-500">demo.guest@easymetrics.local</div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-xs">
                DE
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-zinc-950 dark:text-white">Developer Session</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-medium">Local</span>
                </div>
                <div className="text-[11px] font-mono text-zinc-500">developer@easymetrics.local</div>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={handleSignOut}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer self-start sm:self-auto ${isDemo
              ? 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700'
              : 'border-rose-200 dark:border-rose-900/60 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/40'
              }`}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{isDemo ? 'Exit Demo Session' : 'Sign Out & Clear Storage'}</span>
          </button>
        </div>
      </main>

      {/* ========================================================================= */}
      {/* MODAL: CREATE PROJECT                                                     */}
      {/* ========================================================================= */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div>
              <h3 className="font-bold text-base text-zinc-950 dark:text-white">Create New Project</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Enter a project name. A unique slug and default API key will be auto-generated.
              </p>
            </div>

            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Payment Microservice, Next.js Storefront"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewProjectModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingProject || !newProjectName.trim()}
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors shadow-2xs"
                >
                  {isCreatingProject ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CREATE API KEY                                                     */}
      {/* ========================================================================= */}
      {isNewKeyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div>
              <h3 className="font-bold text-base text-zinc-950 dark:text-white">Generate API Key</h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Create a distinct API key for a specific environment (e.g. Staging, Production).
              </p>
            </div>

            <form onSubmit={handleCreateApiKey} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Key Name / Description
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Production Cluster, Local Dev"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-zinc-300 dark:border-zinc-700 rounded-xl bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsNewKeyModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingKey || !newKeyName.trim()}
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold transition-colors shadow-2xs"
                >
                  {isCreatingKey ? 'Generating...' : 'Generate Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 p-8 text-xs text-zinc-400">Loading settings...</div>}>
      <SettingsContent />
    </Suspense>
  );
}
