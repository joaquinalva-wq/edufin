'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const NAV = [
  { href: 'dashboard',   icon: '🏠', label: 'Inicio'    },
  { href: 'decisions',   icon: '📋', label: 'Decisiones' },
  { href: 'leaderboard', icon: '🏆', label: 'Ranking'    },
  { href: 'evolution',   icon: '📈', label: 'Evolución'  },
];

export function StudentShell({ children, locale }: { children: React.ReactNode; locale: string }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 overflow-y-auto pb-20">{children}</main>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/10">
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-4">
          {NAV.map(({ href, icon, label }) => {
            const active = pathname.includes(`/${href}`);
            return (
              <Link
                key={href}
                href={`/${locale}/${href}`}
                className={cn(
                  'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all duration-200',
                  active ? 'text-violet-400' : 'text-white/40 hover:text-white/70'
                )}
              >
                <span className={cn('text-xl leading-none', active && 'animate-bounce-subtle')}>{icon}</span>
                <span className="text-[10px] font-medium">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
