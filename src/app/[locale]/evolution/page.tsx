'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';

import { formatCurrency, formatPercent } from '@/lib/utils';
import { StudentShell } from '@/components/shared/StudentShell';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import type { Round } from '@/types';

export default function EvolutionPage({ params }: { params: { locale: string } }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const locale = params.locale;

  const [rounds, setRounds] = useState<Round[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push(`/${locale}/login`);
  }, [user, loading, locale, router]);

  useEffect(() => {
    if (!user?.activeCompanyId) { setPageLoading(false); return; }
    getDocs(
      query(
        collection(db, 'rounds'),
        where('companyId', '==', user.activeCompanyId),
        where('status', '==', 'done'),
        orderBy('roundNumber', 'asc')
      )
    ).then(snap => {
      setRounds(snap.docs.map(d => ({ id: d.id, ...d.data() } as Round)));
      setPageLoading(false);
    });
  }, [user]);

  const chartData = [
    { round: 'Inicio', capital: 100000, profitability: 0 },
    ...rounds.filter(r => r.result).map(r => ({
      round: `R${r.roundNumber}`,
      capital: r.result!.endingCapital,
      profitability: r.result!.cumulativeProfitability,
    })),
  ];

  const lastRound = rounds[rounds.length - 1];
  const currentProfitability = lastRound?.result?.cumulativeProfitability ?? 0;
  const currentCapital = lastRound?.result?.endingCapital ?? 100000;

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="glass rounded-xl p-3 text-xs">
        <p className="text-white/60 mb-1">{label}</p>
        <p className="text-white font-bold">{formatCurrency(payload[0].value)}</p>
        <p className={`font-medium ${payload[1]?.value >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
          {formatPercent(payload[1]?.value ?? 0)}
        </p>
      </div>
    );
  };

  return (
    <StudentShell locale={locale}>
      <div className="max-w-2xl mx-auto p-4 pb-24">

        <div className="text-center pt-4 mb-6 animate-slide-up">
          <h1 className="text-2xl font-bold gradient-text">📈 Mi Evolución</h1>
          <p className="text-white/50 text-sm mt-1">Seguimiento del capital ronda por ronda</p>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="glass-card rounded-2xl p-4">
            <p className="text-xs text-white/40 mb-1">Capital actual</p>
            <p className="text-xl font-bold text-white">{formatCurrency(currentCapital, true)}</p>
          </div>
          <div className={`rounded-2xl p-4 border ${currentProfitability >= 0 ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
            <p className="text-xs text-white/40 mb-1">Rentabilidad total</p>
            <p className={`text-xl font-bold ${currentProfitability >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatPercent(currentProfitability)}
            </p>
          </div>
        </div>

        {/* Chart */}
        {pageLoading ? (
          <div className="glass-card rounded-2xl h-64 flex items-center justify-center">
            <div className="text-4xl animate-bounce-subtle">⏳</div>
          </div>
        ) : chartData.length < 2 ? (
          <div className="glass-card rounded-2xl p-8 text-center">
            <p className="text-white/40 text-sm">Completá al menos una ronda para ver tu evolución.</p>
          </div>
        ) : (
          <div className="glass-card rounded-2xl p-4">
            <p className="text-xs text-white/40 mb-3">Capital por ronda (USD)</p>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#7c3aed" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="round" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} width={48} />
                  <Tooltip content={<CustomTooltip />} />
                  <ReferenceLine y={100000} stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4" label={{ value: 'Capital inicial', fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} />
                  <Area type="monotone" dataKey="capital" stroke="#7c3aed" strokeWidth={2} fill="url(#grad)" dot={{ fill: '#7c3aed', r: 4 }} activeDot={{ r: 6 }} name="Capital" />
                  <Area type="monotone" dataKey="profitability" stroke="#ec4899" strokeWidth={1.5} fill="none" strokeDasharray="4 4" dot={false} name="Rentabilidad %" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Round by round table */}
        {rounds.length > 0 && (
          <div className="glass-card rounded-2xl p-4 mt-4">
            <h3 className="font-bold text-white mb-3">Historial de rondas</h3>
            <div className="flex flex-col gap-2">
              {rounds.filter(r => r.result).map(r => (
                <div
                  key={r.id}
                  className="flex items-center justify-between py-2 border-b border-white/5 cursor-pointer hover:bg-white/5 rounded-lg px-2 transition-colors"
                  onClick={() => router.push(`/${locale}/results/${r.id}`)}
                >
                  <div>
                    <span className="text-sm font-medium text-white">Ronda {r.roundNumber}</span>
                    {r.result!.liquidityCrisis && <span className="ml-2 text-xs text-red-400">⚠️ Crisis liquidez</span>}
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${r.result!.capitalChangePct >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatPercent(r.result!.capitalChangePct)}
                    </div>
                    <div className="text-xs text-white/40">{formatCurrency(r.result!.endingCapital, true)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </StudentShell>
  );
}
