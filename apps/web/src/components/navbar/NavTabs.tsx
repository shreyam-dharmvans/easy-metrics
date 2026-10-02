'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useProject } from '../../context/ProjectContext';

export function NavTabs() {
  const pathname = usePathname();
  const { isDemo } = useProject();

  const tabs = [
    {
      name: 'Overview',
      href: isDemo ? '/dashboard?demo=true' : '/dashboard',
      isActive: pathname === '/dashboard',
    },
    {
      name: 'API Routes',
      href: isDemo ? '/dashboard/routes?demo=true' : '/dashboard/routes',
      isActive: pathname.startsWith('/dashboard/routes'),
    },
    {
      name: 'Traces',
      href: isDemo ? '/dashboard/traces?demo=true' : '/dashboard/traces',
      isActive: pathname.startsWith('/dashboard/traces'),
    },
    {
      name: 'Settings',
      href: isDemo ? '/dashboard/settings?demo=true' : '/dashboard/settings',
      isActive: pathname.startsWith('/dashboard/settings'),
    },
  ];

  return (
    <nav className="flex items-center gap-1 text-xs font-medium">
      {tabs.map((tab) => (
        <Link
          key={tab.name}
          href={tab.href}
          className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${tab.isActive
            ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-950 dark:text-white font-semibold shadow-2xs'
            : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
            }`}
        >
          {tab.name}
        </Link>
      ))}
    </nav>
  );
}
