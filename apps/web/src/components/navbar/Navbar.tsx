'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { NavTabs } from './NavTabs';
import { ProjectSwitcher } from './ProjectSwitcher';
import { UserMenu } from './UserMenu';
import { ThemeToggle } from '../ThemeToggle';
import { useAiChat } from '../../context/AiChatContext';
import { useProject, clearAllEasyMetricsStorage, initiateGoogleSignIn } from '../../context/ProjectContext';

export interface NavbarProps {
  // Active project context
  currentProject?: { id: string; name: string };
  onProjectChange?: (project: { id: string; name: string }) => void;

  // AI SRE drawer trigger
  onOpenAiDrawer?: () => void;

  // Whether to show project switcher dropdown (hidden on trace waterfall page)
  showProjectSwitcher?: boolean;
}

export function Navbar({
  currentProject,
  onProjectChange,
  onOpenAiDrawer,
  showProjectSwitcher = true,
}: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isDemo } = useProject();
  const { openDrawer } = useAiChat();
  const handleOpenAi = onOpenAiDrawer || openDrawer;

  const handleExitDemo = () => {
    clearAllEasyMetricsStorage();
    window.location.href = '/';
  };

  return (
    <>
      {isDemo && (
        <div className="bg-emerald-600 text-white px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-2 shadow-sm relative z-40">
          <div className="flex items-center gap-2">
            <span className="font-bold">👀 Live Demo Workspace (Read-Only)</span>
            <span className="hidden sm:inline text-emerald-100">
              • Exploring pre-seeded telemetry for &quot;Demo Web App&quot;.
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExitDemo}
              className="px-2.5 py-1 rounded-md text-emerald-100 hover:text-white hover:bg-emerald-700/80 border border-emerald-500/60 font-medium text-xs transition-colors cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              <span>← Exit Demo</span>
            </button>
            <button
              onClick={initiateGoogleSignIn}
              type="button"
              className="bg-white text-emerald-800 hover:bg-emerald-50 px-2.5 py-1 rounded-md font-bold text-xs shadow-xs transition-colors cursor-pointer"
            >
              Sign In with Google
            </button>
          </div>
        </div>
      )}
      <header className="border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/95 dark:bg-zinc-900/90 backdrop-blur sticky top-0 z-30 shadow-2xs transition-colors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          {/* LEFT: Brand Logo, Project Switcher, & Navigation Tabs */}
          <div className="flex items-center gap-3 sm:gap-6 min-w-0">
            <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
              <Link
                href={isDemo ? "/dashboard?demo=true" : "/dashboard"}
                className="flex items-center gap-2 font-bold text-sm text-zinc-950 dark:text-white group"
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-600 group-hover:bg-emerald-500 transition-colors flex items-center justify-center text-white font-bold text-sm shadow-2xs">
                  ⚡
                </div>
                <span className="tracking-tight hidden sm:inline">EasyMetrics</span>
              </Link>

              {/* Project Switcher Dropdown - Only shown when allowed */}
              {showProjectSwitcher && (
                <>
                  <span className="text-zinc-300 dark:text-zinc-700">/</span>
                  <ProjectSwitcher
                    currentProject={currentProject}
                    onProjectChange={onProjectChange}
                  />
                </>
              )}
            </div>

            {/* Desktop Navigation Links */}
            <div className="hidden md:block">
              <NavTabs />
            </div>
          </div>

          {/* RIGHT: AI SRE Trigger, Theme Toggle, & User Account */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Ask AI SRE Button (Compact, never wraps) */}
            {handleOpenAi && (
              <button
                type="button"
                onClick={handleOpenAi}
                className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-colors shadow-2xs cursor-pointer whitespace-nowrap shrink-0"
                title="Ask AI SRE assistant (⌘K)"
              >
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-indigo-200" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                  <span>Ask AI SRE</span>
                </span>
                <kbd className="text-[10px] bg-indigo-700/80 text-indigo-100 px-1.5 py-0.5 rounded font-mono border border-indigo-400/30">
                  ⌘K
                </kbd>
              </button>
            )}

            {/* Minimalist 32x32 Theme Toggle */}
            <ThemeToggle />

            {/* Developer User Menu */}
            <UserMenu />

            {/* Mobile Hamburger Toggle */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden w-8 h-8 rounded-lg border border-zinc-200 dark:border-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white"
              title="Toggle Menu"
            >
              {mobileMenuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>

        {/* Mobile Menu Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-900 space-y-3">
            <NavTabs />
            {handleOpenAi && (
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleOpenAi();
                }}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 text-white rounded-lg text-xs font-semibold shadow-2xs"
              >
                <span>⚡ Ask AI SRE</span>
                <kbd className="text-[10px] bg-indigo-700 px-1.5 py-0.5 rounded font-mono">⌘K</kbd>
              </button>
            )}
          </div>
        )}
      </header>
    </>
  );
}
