'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '@/lib/firebase/client';

import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { PRODUCTS, LOCATIONS } from '@/constants';
import { Button } from '@/components/ui/button';
import type { Company, Round, Game } from '@/types';

export default function DashboardPage({ params }: { params: { locale: string } }) {
  const { user, loading, isAdmin } = useAuth();
  const t = useTranslations('dashboard');
  const router = useRouter();
  const locale = params.locale;

  const [company, setCompany] = useState<Company | null>(null);
  const [latestRound, setLatestRound] = useState<Round | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push(`/${locale}/login`);
  }, [user, loading, locale, router]);

  useEffect(() => {
    if (!user?.activeCompanyId) { setDataLoading(false); return; }
    async function load() {
      try {
        const compSnap = await getDoc(doc(db, 'companies', user!.activeCompanyId!));
        if (compSnap.exists()) {
          const comp = { id: compSnap.id, ...compSnap.data() } as Company;
          setCompany(comp);

          const [roundsSnap, gameSnap] = await Promise.all([
            getDocs(query(
              collection(db, 'rounds'),
              where('companyId', '==', comp.id),
              orderBy('roundNumber', 'desc'),
              limit(1)
            )),
            comp.gameId ? getDoc(doc(db, 'games', comp.gameId)) : Promise.resolve(null),
          ]);
          if (roundsSnap && !roundsSnap.empty) {
            setLatestRound({ id: roundsSnap.docs[0].id, ...roundsSnap.docs[0].data() } as Round);
          }
          if (gameSnap && gameSnap.exists()) {
            setGame({ id: gameSnap.id, ...gameSnap.data() } as Game);
          }
        }
      } finally {
        setDataLoading(false);
      }
    }
    load();
  }, [user]);

  if (loading || dataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-2 border-violet-500/20 animate-ping" />
            <div className="absolute inset-2 rounded-full border-2 border-violet-500/40 animate-ping" style={{ animationDelay: '0.3s' }} />
            <div className="absolute inset-4 rounded-full bg-violet-600/60 animate-pulse" />
          </div>
          <p className="text-white/40 text-sm">Cargando tu empresa...</p>
        </div>
      </div>
    );
  }

  // No company yet → redirect to create
  if (!user?.activeCompanyId || !company) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center glass-card rounded-3xl p-10 max-w-sm border border-violet-500/20">
          <div className="text-6xl mb-4">🏗️</div>
          <h2 className="text-xl font-bold text-white mb-2">¡Construí tu empresa!</h2>
          <p className="text-white/50 text-sm mb-6">Todavía no tenés una empresa en el juego. Creala para empezar a competir.</p>
          <Button variant="gradient" size="lg" onClick={() => router.push(`/${locale}/company/create`)}>
            🚀 Fundar mi empresa
          </Button>
        </div>
      </div>
    );
  }

  const product = PRODUCTS[company.productId];
  const location = LOCATIONS[company.locationId];
  const roundOpen = latestRound?.status === 'open';
  const profitability = ((company.currentCapital - company.initialCapital) / company.initialCapital) * 100;
  const isPositive = company.currentCapital >= company.initialCapital;
  const isGameHost = game && user && game.adminUid === user.uid;
  const isManualMode = game?.simulationMode === 'manual';
  const totalRounds = game?.totalRounds ?? 10;
  const currentRound = latestRound?.roundNumber ?? 0;
  const gameProgress = Math.round((currentRound / totalRounds) * 100);

  // Company "tier" based on profitability
  const tier =
    profitability >= 50  ? { label: 'Corporación', emoji: '🏙️', color: 'from-amber-400 to-orange-500' } :
    profitability >= 20  ? { label: 'En crecimiento', emoji: '📈', color: 'from-emerald-400 to-teal-500' } :
    profitability >= 0   ? { label: 'Estable', emoji: '🏢', color: 'from-violet-400 to-purple-500' } :
    profitability >= -20 ? { label: 'En riesgo', emoji: '⚠️', color: 'from-amber-400 to-red-500' } :
                           { label: 'En crisis', emoji: '🚨', color: 'from-red-500 to-rose-700' };

  async function handleSimulateNow() {
    if (!game || !user) return;
    const token = await getAuth().currentUser?.getIdToken();
    if (!token) return;
    setSimulating(true);
    try {
      const res = await fetch('/api/simulate-now', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ gameId: game.id }),
      });
      const data = await res.json();
      if (data.success) window.location.reload();
      else alert(`Error: ${data.error}`);
    } catch {
      alert('Error de red. Intentá de nuevo.');
    } finally {
      setSimulating(false);
    }
  }

  return (
    <div className="min-h-screen pb-24">

      {/* ── GAME HEADER (city district visual) ── */}
      <div className="relative overflow-hidden mb-4">
        {/* City skyline background */}
        <div className="absolute inset-0 bg-gradient-to-b from-violet-900/60 via-indigo-900/40 to-transparent" />
        {/* Decorative cityscape silhouette */}
        <div className="absolute bottom-0 left-0 right-0 h-12 flex items-end justify-around opacity-20 pointer-events-none">
          {[32,48,28,56,36,44,24,52,40,32,60,28,44,36,50].map((h, i) => (
            <div key={i} className="bg-white rounded-t-sm" style={{ height: h, width: 12 + (i % 3) * 4 }} />
          ))}
        </div>

        <div className="relative z-10 p-4 pt-6 pb-8">
          {/* Admin shortcut */}
          {isAdmin && (
            <button
              onClick={() => router.push(`/${locale}/admin`)}
              className="absolute top-4 right-4 flex items-center gap-1.5 bg-violet-600/30 hover:bg-violet-600/50 border border-violet-500/40 rounded-xl px-3 py-1.5 text-xs font-medium text-violet-300 transition-all"
            >
              ⚙️ Admin
            </button>
          )}

          {/* Company identity */}
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl font-black text-white shadow-2xl flex-shrink-0 border-2 border-white/20"
              style={{ backgroundColor: company.logoColor }}
            >
              {company.brandName.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-black text-white truncate">{company.name}</h1>
              <p className="text-white/50 text-sm truncate">
                {product?.emoji} {product?.id.replace(/_/g,' ')} · {location?.emoji} {location?.id.replace(/_/g,' ')}
              </p>
              <div className={`inline-flex items-center gap-1.5 mt-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r ${tier.color} bg-opacity-20`}
                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
                <span className="text-xs">{tier.emoji}</span>
                <span className="text-xs font-semibold text-white">{tier.label}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4">

        {/* ── SCORE CARDS ── */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Capital */}
          <div className="glass-card rounded-2xl p-4 border border-violet-500/20 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-20 h-20 bg-violet-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-xl" />
            <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-1">Capital</p>
            <p className="text-2xl font-black text-white">{formatCurrency(company.currentCapital, true)}</p>
            <p className="text-[10px] text-white/30 mt-1">Inicial: {formatCurrency(company.initialCapital, true)}</p>
          </div>

          {/* Rentabilidad */}
          <div className={`rounded-2xl p-4 relative overflow-hidden border ${
            isPositive
              ? 'bg-gradient-success border-emerald-500/20'
              : 'bg-gradient-danger border-red-500/20'
          }`}>
            <div className={`absolute top-0 right-0 w-20 h-20 rounded-full -translate-y-1/2 translate-x-1/2 blur-xl ${
              isPositive ? 'bg-emerald-500/15' : 'bg-red-500/15'
            }`} />
            <p className="text-white/40 text-xs font-medium uppercase tracking-wider mb-1">Rentabilidad</p>
            <p className={`text-2xl font-black ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {isPositive ? '+' : ''}{formatPercent(profitability)}
            </p>
            <p className="text-[10px] text-white/30 mt-1">{isPositive ? '↑ Ganando' : '↓ Perdiendo'}</p>
          </div>
        </div>

        {/* ── COMPANY STATS (game meters) ── */}
        <div className="glass-card rounded-2xl p-4 mb-4 border border-white/5">
          <p className="text-[10px] text-white/30 uppercase tracking-widest mb-3 font-medium">Estado de la empresa</p>
          <div className="flex flex-col gap-3">
            {[
              { label: 'Marca', value: company.brandStrength, color: 'bg-violet-500', glow: 'shadow-violet-500/50' },
              { label: 'Satisfacción', value: company.customerSatisfaction, color: 'bg-pink-500', glow: 'shadow-pink-500/50' },
              { label: 'Moral del equipo', value: company.employeeMorale, color: 'bg-amber-500', glow: 'shadow-amber-500/50' },
            ].map(({ label, value, color, glow }) => {
              const pct = Math.round(value * 100);
              const barColor = pct >= 70 ? color : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
              return (
                <div key={label}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-white/50">{label}</span>
                    <span className="text-xs font-bold text-white">{pct}%</span>
                  </div>
                  <div className="h-2 bg-white/8 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${barColor} shadow-sm ${pct >= 70 ? glow : ''}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── HOST PANEL ── */}
        {isGameHost && game && (
          <div className="rounded-2xl p-4 mb-4 border border-violet-500/30 bg-violet-500/8">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">👑</span>
              <span className="text-sm font-bold text-violet-300">Panel de anfitrión</span>
              <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium ${
                isManualMode ? 'bg-violet-500/30 text-violet-200' : 'bg-blue-500/20 text-blue-300'
              }`}>
                {isManualMode ? '🎯 Manual' : '⏰ Automático'}
              </span>
            </div>
            <div className="bg-black/20 rounded-xl p-3 mb-3">
              <p className="text-[10px] text-white/40 mb-1">Código del grupo — compartilo con tus estudiantes</p>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-black tracking-[0.3em] text-violet-300 font-mono">{game.joinCode}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(game.joinCode)}
                  className="text-xs text-white/40 hover:text-white/70 transition-colors bg-white/8 px-2 py-1 rounded-lg"
                >
                  📋 Copiar
                </button>
              </div>
            </div>
            {isManualMode && game.status === 'active' && (
              <Button variant="gradient" size="lg" className="w-full" loading={simulating} onClick={handleSimulateNow}>
                ⚡ Simular mes ahora
              </Button>
            )}
            {!isManualMode && (
              <p className="text-xs text-white/30 text-center">La simulación corre automáticamente todos los días a las 19:00 hs.</p>
            )}
          </div>
        )}

        {/* ── ROUND / TURN ── */}
        <div className={`rounded-2xl p-5 mb-4 border ${roundOpen ? 'bg-violet-500/10 border-violet-500/30' : 'bg-white/4 border-white/8'}`}>
          {latestRound ? (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[10px] text-white/40 uppercase tracking-widest">Turno actual</p>
                  <div className="flex items-baseline gap-1 mt-0.5">
                    <span className="text-3xl font-black text-white">{currentRound}</span>
                    <span className="text-white/30 font-medium">/ {totalRounds} meses</span>
                  </div>
                </div>
                <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                  roundOpen ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' : 'bg-white/8 text-white/40 border border-white/10'
                }`}>
                  {roundOpen ? '🟢 Decisiones abiertas' : '🔒 Cerrado'}
                </div>
              </div>

              {/* Progress track (like a game timeline) */}
              <div className="mb-4">
                <div className="flex gap-1 mb-1.5">
                  {Array.from({ length: totalRounds }, (_, i) => (
                    <div key={i} className={`flex-1 h-2 rounded-full transition-all duration-500 ${
                      i < currentRound - 1 ? 'bg-violet-500' :
                      i === currentRound - 1 && roundOpen ? 'bg-violet-400 animate-pulse' :
                      i === currentRound - 1 ? 'bg-violet-300' :
                      'bg-white/10'
                    }`} />
                  ))}
                </div>
                <div className="flex justify-between text-[10px] text-white/25">
                  <span>Inicio</span>
                  <span>{gameProgress}% completado</span>
                  <span>Fin</span>
                </div>
              </div>

              {/* CTA */}
              {roundOpen ? (
                <Button variant="gradient" size="lg" className="w-full text-base font-bold" onClick={() => router.push(`/${locale}/decisions`)}>
                  📋 Tomar decisiones del mes →
                </Button>
              ) : latestRound.status === 'done' ? (
                <Button variant="secondary" size="lg" className="w-full" onClick={() => router.push(`/${locale}/results/${latestRound.id}`)}>
                  📊 Ver informe del mes {currentRound}
                </Button>
              ) : (
                <div className="text-center text-white/40 text-sm py-2">
                  {isManualMode
                    ? '⏳ Esperando que el anfitrión corra la simulación...'
                    : '⏳ Resultados disponibles hoy a las 19:00 hs'}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-2">
              <div className="text-3xl mb-2">🎬</div>
              <p className="text-white/50 text-sm">El juego todavía no arrancó.</p>
              <p className="text-white/30 text-xs mt-1">Esperá que el admin inicie la primera ronda.</p>
            </div>
          )}
        </div>

        {/* ── QUICK ACTIONS ── */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Ranking', emoji: '🏆', route: 'leaderboard', color: 'hover:border-amber-500/40 hover:bg-amber-500/8' },
            { label: 'Evolución', emoji: '📈', route: 'evolution', color: 'hover:border-emerald-500/40 hover:bg-emerald-500/8' },
            {
              label: 'Informe',
              emoji: '📊',
              route: `results/${latestRound?.id ?? ''}`,
              color: 'hover:border-blue-500/40 hover:bg-blue-500/8',
              disabled: !latestRound?.result,
            },
          ].map(({ label, emoji, route, color, disabled }) => (
            <button
              key={label}
              onClick={() => !disabled && router.push(`/${locale}/${route}`)}
              disabled={!!disabled}
              className={`glass-card rounded-2xl p-4 text-center border border-white/8 transition-all duration-200 ${color} disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              <div className="text-2xl mb-1.5">{emoji}</div>
              <div className="text-xs font-semibold text-white/80">{label}</div>
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}
