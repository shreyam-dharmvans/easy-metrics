'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useProject } from '../../context/ProjectContext';

interface ProjectSwitcherProps {
  currentProject?: { id: string; name: string };
  onProjectChange?: (project: { id: string; name: string }) => void;
}

export function ProjectSwitcher({
  currentProject: propProject,
  onProjectChange,
}: ProjectSwitcherProps = {}) {
  const { projects, currentProject: contextProject, switchProject, isLoading, isDemo } = useProject();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeProject = propProject || contextProject;

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative shrink-0" ref={containerRef}>
      {/* Switcher Badge */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800/90 rounded-md text-xs font-semibold text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700/80 hover:bg-zinc-200/70 dark:hover:bg-zinc-700/60 transition-colors cursor-pointer shadow-2xs"
        title="Switch active project"
      >
        <span className="max-w-[130px] truncate">{activeProject.name}</span>
        <span className="text-[10px] text-zinc-400">▾</span>
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <div className="absolute left-0 top-full mt-2 w-64 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl py-1.5 z-50 text-xs text-zinc-700 dark:text-zinc-200 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1.5 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
            Your Projects
          </div>

          <div className="max-h-52 overflow-y-auto py-1">
            {isLoading && projects.length === 0 ? (
              <div className="px-3 py-2 text-zinc-400 text-center text-xs">Loading projects...</div>
            ) : projects.length === 0 ? (
              <div className="px-3 py-2 text-zinc-400 text-center text-xs">No projects found</div>
            ) : (
              projects.map((proj) => {
                const isSelected = proj.id === activeProject.id;
                return (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() => {
                      switchProject(proj.id);
                      onProjectChange?.({ id: proj.id, name: proj.name });
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer ${isSelected ? 'font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/5' : ''
                      }`}
                  >
                    <div className="truncate mr-2">
                      <div className="truncate text-zinc-900 dark:text-white font-medium">{proj.name}</div>
                      {proj._count && (
                        <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-normal">
                          {proj._count.traces} traces · {proj._count.apiKeys} keys
                        </div>
                      )}
                    </div>
                    {isSelected && <span className="text-xs text-emerald-600 dark:text-emerald-400">✓</span>}
                  </button>
                );
              })
            )}
          </div>

          <div className="pt-1 mt-1 border-t border-zinc-100 dark:border-zinc-800">
            <Link
              href={isDemo ? "/dashboard/settings?demo=true" : "/dashboard/settings"}
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
            >
              <span>⚙️</span>
              <span>Manage Projects &amp; Settings</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
