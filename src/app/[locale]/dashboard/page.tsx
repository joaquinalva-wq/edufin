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
  const { user, loading } = useAuth();
  const t = useTranslations('dashboard');
  const tP = useTranslations('products');
  const tL = useTranslations('locations');
  const router = useRouter();
  const locale = params.locale;

  const [company, setCompany] = useState<Company | null>(null);
  const [latestRound, setLatestRound] = useState<Round | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [simulating, setSimulating] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push(`/${locale}/login`);
    }
  }, [user, loading, locale, router]);

  useEffect(() => {
    if (!user?.activeCompanyId) {
      setDataLoading(false);
      return;
    }
    async function load() {
      try {
        const compSnap = await getDoc(doc(db, 'companies', user!.activeCompanyId!));
        if (compSnap.exists()) {
          const comp = { id: compSnap.id, ...compSnap.data() } as Company;
          setCompany(comp);

          // Get latest round and game in parallel
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
          <div className="text-5xl animate-bounce-subtle mb-4">⏳</div>
          <p className="text-white/50">Cargando tu empresa...</p>
        </div>
      </div>
    );
  }

  // No company yet → redirect to create
  if (!user?.activeCompanyId || !company) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center glass-card rounded-3xl p-10 max-w-sm">
          <div className="text-5xl mb-4">🏗️</div>
          <h2 className="text-xl font-bold text-white mb-2">Todavía no tenés empresa</h2>
          <p className="text-white/50 text-sm mb-6">Creá tu empresa para empezar a jugar.</p>
          <Button variant="gradient" size="lg" onClick={() => router.push(`/${locale}/company/create`)}>
            Crear mi empresa 🚀
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
      if (data.success) {
        window.location.reload();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch {
      alert('Error de red. Intentá de nuevo.');
    } finally {
      setSimulating(false);
    }
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 pb-24">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-6 animate-slide-up">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shadow-lg flex-shrink-0"
            style={{ backgroundColor: company.logoColor }}
          >
            {company.brandName.charAt(0)}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{company.name}</h1>
            <p className="text-white/50 text-sm">
              {product?.emoji} {tP(`${company.productId}.name`)} · {location?.emoji} {tL(`${company.locationId}.name`)}
            </p>
          </div>
          <div className="ml-auto">
            <button
              onClick={() => router.push(`/${locale}/leaderboard`)}
              className="text-2xl hover:scale-110 transition-transform"
              title="Ver ranking"
            >
              🏆
            </button>
          </div>
        </div>

        {/* Capital cards */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="glass-card rounded-2xl p-4">
            <p className="text-white/50 text-xs mb-1">{t('capital')}</p>
            <p className="text-2xl font-bold text-white">{formatCurrency(company.currentCapital, true)}</p>
          </div>
          <div className={`rounded-2xl p-4 ${isPositive ? 'bg-gradient-success border border-emerald-500/20' : 'bg-gradient-danger border border-red-500/20'}`}>
            <p className="text-white/50 text-xs mb-1">{t('profitability')}</p>
            <p className={`text-2xl font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatPercent(profitability)}
            </p>
          </div>
        </div>

        {/* Company state indicators */}
        <div className="glass-card rounded-2xl p-4 mb-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-xs text-white/40 mb-1">{t('brand')}</p>
              <div className="h-1.5 bg-white/10 rounded-full mt-1">
                <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${company.brandStrength * 100}%` }} />
              </div>
              <p className="text-xs text-white/60 mt-1">{Math.round(company.brandStrength * 100)}%</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-white/40 mb-1">{t('cs')}</p>
              <div className="h-1.5 bg-white/10 rounded-full mt-1">
                <div className="h-full bg-pink-500 rounded-full transition-all" style={{ width: `${company.customerSatisfaction * 100}%` }} />
              </div>
              <p className="text-xs text-white/60 mt-1">{Math.round(company.customerSatisfaction * 100)}%</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-white/40 mb-1">Moral equipo</p>
              <div className="h-1.5 bg-white/10 rounded-full mt-1">
                <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${company.employeeMorale * 100}%` }} />
              </div>
              <p className="text-xs text-white/60 mt-1">{Math.round(company.employeeMorale * 100)}%</p>
            </div>
          </div>
        </div>

        {/* Host panel — only visible to game creator */}
        {isGameHost && game && (
          <div className="rounded-2xl p-4 mb-4 border border-violet-500/40 bg-violet-500/8">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">👑</span>
              <span className="text-sm font-bold text-violet-300">Panel de anfitrión</span>
              <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full font-medium ${isManualMode ? 'bg-violet-500/30 text-violet-200' : 'bg-blue-500/20 text-blue-300'}`}>
                {isManualMode ? '🎯 Manual' : '⏰ Automático'}
              </span>
            </div>

            {/* Join code */}
            <div className="bg-white/5 rounded-xl p-3 mb-3">
              <p className="text-xs text-white/40 mb-1">Código del grupo — compartilo con tus compañeros</p>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-black tracking-[0.3em] text-violet-300 font-mono">{game.joinCode}</span>
                <button
                  onClick={() => navigator.clipboard.writeText(game.joinCode)}
                  className="text-xs text-white/40 hover:text-white/70 transition-colors bg-white/5 px-2 py-1 rounded-lg"
                >
                  📋 Copiar
                </button>
              </div>
            </div>

            {/* Manual simulation button */}
            {isManualMode && game.status === 'active' && (
              <Button
                variant="gradient"
                size="lg"
                className="w-full"
                loading={simulating}
                onClick={handleSimulateNow}
              >
                ⚡ Simular ronda ahora
              </Button>
            )}
            {!isManualMode && (
              <p className="text-xs text-white/40 text-center">La simulación corre automáticamente todos los días a las 19:00 hs.</p>
            )}
          </div>
        )}

        {/* Round status */}
        <div className={`rounded-2xl p-5 mb-4 border ${roundOpen ? 'bg-violet-500/10 border-violet-500/30' : 'bg-white/5 border-white/10'}`}>
          {latestRound ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-white/40">{t('round')}</p>
                  <p className="text-lg font-bold text-white">
                    Mes {latestRound.roundNumber} / {game?.totalRounds ?? 10}
                  </p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${roundOpen ? 'bg-violet-500/20 text-violet-300' : 'bg-white/10 text-white/50'}`}>
                  {roundOpen ? t('decisions_open') : t('decisions_locked')}
                </div>
              </div>

              {/* Round progress dots */}
              <div className="flex gap-1 mb-4">
                {Array.from({ length: game?.totalRounds ?? 10 }, (_, i) => (
                  <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${
                    i < latestRound.roundNumber - 1 ? 'bg-violet-500' :
                    i === latestRound.roundNumber - 1 && roundOpen ? 'bg-violet-400 animate-pulse' :
                    i === latestRound.roundNumber - 1 ? 'bg-violet-300' :
                    'bg-white/10'
                  }`} />
                ))}
              </div>

              {roundOpen ? (
                <Button variant="gradient" size="lg" className="w-full" onClick={() => router.push(`/${locale}/decisions`)}>
                  📋 {t('make_decisions')}
                </Button>
              ) : latestRound.status === 'done' ? (
                <Button variant="secondary" size="lg" className="w-full" onClick={() => router.push(`/${locale}/results/${latestRound.id}`)}>
                  📊 {t('view_results')}
                </Button>
              ) : (
                <div className="text-center text-white/50 text-sm py-2">
                  {isManualMode
                    ? '⏳ Esperando que el anfitrión corra la simulación...'
                    : '⏳ El informe del mes estará disponible hoy a las 19:00 hs'}
                </div>
              )}
            </>
          ) : (
            <div className="text-center">
              <p className="text-white/50 text-sm">El juego todavía no arrancó. Esperá que el admin o anfitrión inicie la primera ronda.</p>
            </div>
          )}
        </div>

        {/* Quick nav */}
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => router.push(`/${locale}/leaderboard`)}
            className="glass-card rounded-2xl p-4 text-center hover:bg-violet-500/10 transition-colors"
          >
            <div className="text-2xl mb-1">🏆</div>
            <div className="text-xs font-medium text-white">{t('leaderboard')}</div>
          </button>
          <button
            onClick={() => router.push(`/${locale}/evolution`)}
            className="glass-card rounded-2xl p-4 text-center hover:bg-violet-500/10 transition-colors"
          >
            <div className="text-2xl mb-1">📈</div>
            <div className="text-xs font-medium text-white">{t('my_evolution')}</div>
          </button>
          <button
            onClick={() => router.push(`/${locale}/results/${latestRound?.id ?? ''}`)}
            disabled={!latestRound?.result}
            className="glass-card rounded-2xl p-4 text-center hover:bg-violet-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <div className="text-2xl mb-1">📊</div>
            <div className="text-xs font-medium text-white">Último informe</div>
          </button>
        </div>
      </div>
    </div>
  );
}
