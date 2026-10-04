'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Settings,
  FolderKanban,
  KeyRound,
  SlidersHorizontal,
  Code2,
  LogOut,
  Sparkles,
  Bot,
} from 'lucide-react';
import { useProject, clearAllEasyMetricsStorage } from '../../context/ProjectContext';

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
}

export function UserMenu() {
  const router = useRouter();
  const { currentProject, isDemo } = useProject();
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Fetch current user profile on mount
  useEffect(() => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    fetch(`${apiUrl}/api/v1/auth/me`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.user) {
          setUser(data.user);
          if (typeof window !== 'undefined' && data.user.id) {
            localStorage.setItem('easymetrics_user_id', data.user.id);
          }
        }
      })
      .catch((err) => {
        console.error('Failed to load user profile in UserMenu:', err);
      });
  }, [isDemo]);

  // Close user dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    try {
      await fetch(`${apiUrl}/api/v1/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('Failed to logout from API:', err);
    }
    clearAllEasyMetricsStorage();
    setIsOpen(false);
    router.push('/');
  };

  const displayName = isDemo ? 'Demo Visitor' : (user?.name || 'Developer');
  const displayEmail = isDemo ? 'demo.guest@easymetrics.local' : (user?.email || 'developer@easymetrics.local');
  const initials = isDemo
    ? 'DM'
    : displayName
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();

  return (
    <div className="relative shrink-0" ref={menuRef}>
      {/* Avatar Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 via-teal-600 to-indigo-600 text-white font-bold text-xs shadow-xs hover:ring-2 hover:ring-indigo-500/40 transition-all cursor-pointer select-none overflow-hidden"
        title="Account & Settings"
        aria-label="User Account Menu"
      >
        {!isDemo && user?.avatar ? (
          <img
            src={user.avatar}
            alt={displayName}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span>{initials || 'DE'}</span>
        )}
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 rounded-2xl border border-zinc-200/90 dark:border-zinc-800 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-2xl p-2 z-50 text-xs text-zinc-700 dark:text-zinc-200 animate-in fade-in zoom-in-95 duration-100">
          {/* User Profile Header */}
          <div className="p-2.5 rounded-xl bg-zinc-50/80 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/60 mb-1.5">
            <div className="flex items-center justify-between mb-1">
              <div className="font-bold text-sm text-zinc-950 dark:text-white truncate max-w-[150px]">
                {displayName}
              </div>
              {isDemo ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/80">
                  Demo Mode
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/80">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active
                </span>
              )}
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate font-mono">
              {displayEmail}
            </div>
          </div>

          {/* Active Workspace Banner */}
          <div className="px-2.5 py-2 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/80 dark:border-indigo-900/40 mb-2">
            <div className="text-[10px] uppercase font-bold text-indigo-700 dark:text-indigo-400 tracking-wider">
              Current Project
            </div>
            <div className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate mt-0.5">
              {currentProject.name}
            </div>
          </div>

          {/* Navigation Links */}
          <div className="space-y-0.5">
            <Link
              href={isDemo ? "/dashboard/settings?demo=true" : "/dashboard/settings"}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors"
            >
              <Settings className="w-4 h-4 text-zinc-400" />
              <span className="font-medium">Settings &amp; Workspace</span>
            </Link>

            <Link
              href={isDemo ? "/dashboard/settings?tab=projects&demo=true" : "/dashboard/settings?tab=projects"}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors"
            >
              <FolderKanban className="w-4 h-4 text-zinc-400" />
              <span className="font-medium">Manage Projects</span>
            </Link>

            <Link
              href={isDemo ? "/dashboard/settings?tab=apikeys&demo=true" : "/dashboard/settings?tab=apikeys"}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors"
            >
              <KeyRound className="w-4 h-4 text-zinc-400" />
              <span className="font-medium">API Keys</span>
            </Link>

            <Link
              href={isDemo ? "/dashboard/settings?tab=thresholds&demo=true" : "/dashboard/settings?tab=thresholds"}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors"
            >
              <SlidersHorizontal className="w-4 h-4 text-zinc-400" />
              <span className="font-medium">Latency Thresholds</span>
            </Link>

            <Link
              href={isDemo ? "/dashboard/settings?tab=sdk&demo=true" : "/dashboard/settings?tab=sdk"}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors"
            >
              <Code2 className="w-4 h-4 text-zinc-400" />
              <span className="font-medium">SDK Integration Guide</span>
            </Link>

            <Link
              href={isDemo ? "/dashboard/settings?tab=mcp&demo=true" : "/dashboard/settings?tab=mcp"}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white transition-colors"
            >
              <Bot className="w-4 h-4 text-zinc-400" />
              <span className="font-medium">MCP Server (AI IDE Setup)</span>
            </Link>
          </div>

          {/* Divider */}
          <div className="border-t border-zinc-100 dark:border-zinc-800/80 my-1.5" />

          {/* Sign Out */}
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer font-medium"
          >
            <LogOut className="w-4 h-4 text-rose-500" />
            <span>{isDemo ? 'Exit Demo Session' : 'Sign Out & Clear Session'}</span>
          </button>
        </div>
      )}
    </div>
  );
}
