'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';

import { formatCurrency, formatPercent } from '@/lib/utils';
import { PRODUCTS, LOCATIONS } from '@/constants';
import { StudentShell } from '@/components/shared/StudentShell';
import type { LeaderboardEntry } from '@/types';

export default function LeaderboardPage({ params }: { params: { locale: string } }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const locale = params.locale;

  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [tab, setTab] = useState<'game' | 'global'>('game');
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push(`/${locale}/login`);
  }, [user, loading, locale, router]);

  useEffect(() => {
    if (!user) return;
    loadLeaderboard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, tab]);

  async function loadLeaderboard() {
    setPageLoading(true);
    try {
      if (tab === 'game' && user?.activeGameId) {
        const snap = await getDocs(
          query(
            collection(db, 'leaderboard', user.activeGameId, 'entries'),
            orderBy('rank', 'asc'),
            limit(50)
          )
        );
        setEntries(snap.docs.map(d => ({ ...d.data() } as LeaderboardEntry)));
      } else {
        // Global: aggregate from all leaderboards — simplified: query companies sorted by profitability
        const snap = await getDocs(
          query(collection(db, 'companies'), orderBy('netWorth', 'desc'), limit(50))
        );
        const list: LeaderboardEntry[] = snap.docs.map((d, i) => {
          const data = d.data();
          return {
            uid: data.uid,
            companyId: d.id,
            displayName: '',
            school: '',
            grade: '',
            companyName: data.name,
            brandName: data.brandName,
            productId: data.productId,
            locationId: data.locationId,
            currentCapital: data.currentCapital,
            netWorth: data.netWorth,
            cumulativeProfitability: ((data.currentCapital - data.initialCapital) / data.initialCapital) * 100,
            rank: i + 1,
            roundsCompleted: data.roundsCompleted,
            lastUpdated: data.createdAt,
          };
        });
        setEntries(list);
      }
    } finally {
      setPageLoading(false);
    }
  }

  const myUid = user?.uid;

  return (
    <StudentShell locale={locale}>
      <div className="max-w-2xl mx-auto p-4 pb-24">

        {/* Header */}
        <div className="text-center pt-4 mb-6 animate-slide-up">
          <h1 className="text-3xl">🏆</h1>
          <h2 className="text-2xl font-bold gradient-text mt-1">Ranking</h2>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4 bg-white/5 rounded-xl p-1">
          {(['game', 'global'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-violet-600 text-white shadow' : 'text-white/50 hover:text-white'}`}
            >
              {t === 'game' ? '🎮 Mi juego' : '🌍 Global'}
            </button>
          ))}
        </div>

        {pageLoading ? (
          <div className="text-center py-12"><div className="text-4xl animate-bounce-subtle">⏳</div></div>
        ) : entries.length === 0 ? (
          <div className="glass-card rounded-2xl p-8 text-center">
            <p className="text-white/40">No hay datos todavía. Completá la primera ronda.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {entries.map((entry) => {
              const isMe = entry.uid === myUid;
              const product = PRODUCTS[entry.productId];
              const location = LOCATIONS[entry.locationId];
              const isTop3 = entry.rank <= 3;
              const medals = ['🥇', '🥈', '🥉'];

              return (
                <div
                  key={entry.uid}
                  className={`rounded-2xl p-4 border transition-all ${isMe
                    ? 'border-violet-500/60 bg-violet-500/10 glow-purple'
                    : 'border-white/10 glass'}`}
                >
                  <div className="flex items-center gap-3">
                    {/* Rank */}
                    <div className="w-10 text-center flex-shrink-0">
                      {isTop3
                        ? <span className="text-2xl">{medals[entry.rank - 1]}</span>
                        : <span className="text-lg font-bold text-white/40">#{entry.rank}</span>}
                    </div>

                    {/* Company info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-white text-sm truncate">{entry.companyName}</span>
                        {isMe && <span className="text-[10px] bg-violet-500/30 text-violet-300 px-1.5 py-0.5 rounded-full flex-shrink-0">Vos</span>}
                      </div>
                      <div className="text-xs text-white/40 flex gap-2 mt-0.5">
                        <span>{product?.emoji} {entry.productId}</span>
                        <span>{location?.emoji} {entry.locationId}</span>
                        {entry.school && <span>· {entry.school}</span>}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="text-right flex-shrink-0">
                      <div className={`text-sm font-bold ${entry.cumulativeProfitability >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatPercent(entry.cumulativeProfitability)}
                      </div>
                      <div className="text-xs text-white/40">{formatCurrency(entry.currentCapital, true)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </StudentShell>
  );
}
