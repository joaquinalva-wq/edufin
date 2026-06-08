'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

// SVG icons for game-like nav
function IconHome({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path d="M3 12L12 3l9 9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9 21V12h6v9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 12v9h18V12" strokeLinecap="round" strokeLinejoin="round" opacity={0} />
    </svg>
  );
}
function IconClipboard({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <rect x="8" y="2" width="8" height="4" rx="1" strokeLinecap="round" />
      <path d="M8 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2h-2" strokeLinecap="round" />
      <path d="M9 12h6M9 16h4" strokeLinecap="round" />
    </svg>
  );
}
function IconTrophy({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path d="M8 21h8M12 17v4" strokeLinecap="round" />
      <path d="M5 4H3v4a4 4 0 004 4h10a4 4 0 004-4V4h-2" strokeLinecap="round" />
      <path d="M5 4h14v6a7 7 0 01-14 0V4z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconChart({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 16l4-4 4 4 4-8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconSettings({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} className="w-5 h-5">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" strokeLinecap="round" />
    </svg>
  );
}

const BASE_NAV = [
  { href: 'dashboard',   Icon: IconHome,      label: 'Inicio'     },
  { href: 'decisions',   Icon: IconClipboard, label: 'Decisiones' },
  { href: 'leaderboard', Icon: IconTrophy,    label: 'Ranking'    },
  { href: 'evolution',   Icon: IconChart,     label: 'Evolución'  },
];

export function StudentShell({ children, locale }: { children: React.ReactNode; locale: string }) {
  const pathname = usePathname();
  const { isAdmin } = useAuth();

  const navItems = isAdmin
    ? [...BASE_NAV, { href: 'admin', Icon: IconSettings, label: 'Admin' }]
    : BASE_NAV;

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 overflow-y-auto pb-20">{children}</main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/8">
        <div className={cn(
          'flex justify-around items-center h-16 max-w-lg mx-auto px-2',
          isAdmin ? 'max-w-xl' : ''
        )}>
          {navItems.map(({ href, Icon, label }) => {
            const active = pathname.includes(`/${href}`);
            return (
              <Link
                key={href}
                href={`/${locale}/${href}`}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-xl transition-all duration-200 min-w-[52px]',
                  active
                    ? href === 'admin'
                      ? 'text-violet-400'
                      : 'text-violet-400'
                    : 'text-white/35 hover:text-white/60'
                )}
              >
                {/* Active indicator dot */}
                <div className={cn(
                  'w-1 h-1 rounded-full mb-0.5 transition-all',
                  active ? 'bg-violet-400' : 'bg-transparent'
                )} />
                <Icon active={active} />
                <span className="text-[9px] font-medium mt-0.5">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
