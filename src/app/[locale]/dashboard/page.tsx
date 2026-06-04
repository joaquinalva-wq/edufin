'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';

import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { PRODUCTS, LOCATIONS } from '@/constants';
import { Button } from '@/components/ui/button';
import type { Company, Round } from '@/types';

export default function DashboardPage({ params }: { params: { locale: string } }) {
  const { user, loading } = useAuth();
  const t = useTranslations('dashboard');
  const tP = useTranslations('products');
  const tL = useTranslations('locations');
  const router = useRouter();
  const locale = params.locale;

  const [company, setCompany] = useState<Company | null>(null);
  const [latestRound, setLatestRound] = useState<Round | null>(null);
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

          // Get latest round
          const roundsQ = query(
            collection(db, 'rounds'),
            where('companyId', '==', comp.id),
            orderBy('roundNumber', 'desc'),
            limit(1)
          );
          const roundsSnap = await getDocs(roundsQ);
          if (!roundsSnap.empty) {
            setLatestRound({ id: roundsSnap.docs[0].id, ...roundsSnap.docs[0].data() } as Round);
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

        {/* Round status */}
        <div className={`rounded-2xl p-5 mb-4 border ${roundOpen ? 'bg-violet-500/10 border-violet-500/30' : 'bg-white/5 border-white/10'}`}>
          {latestRound ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-white/40">{t('round')}</p>
                  <p className="text-lg font-bold text-white">
                    Ronda {latestRound.roundNumber} / {10}
                  </p>
                </div>
                <div className={`px-3 py-1 rounded-full text-xs font-medium ${roundOpen ? 'bg-violet-500/20 text-violet-300' : 'bg-white/10 text-white/50'}`}>
                  {roundOpen ? t('decisions_open') : t('decisions_locked')}
                </div>
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
                  ⏳ Simulando resultados... disponibles mañana
                </div>
              )}
            </>
          ) : (
            <div className="text-center">
              <p className="text-white/50 text-sm">El juego todavía no arrancó. Esperá que el admin inicie la primera ronda.</p>
            </div>
          )}
        </div>

        {/* Quick nav */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => router.push(`/${locale}/leaderboard`)}
            className="glass-card rounded-2xl p-4 text-left hover:bg-violet-500/10 transition-colors"
          >
            <div className="text-2xl mb-1">🏆</div>
            <div className="text-sm font-medium text-white">{t('leaderboard')}</div>
          </button>
          <button
            onClick={() => router.push(`/${locale}/evolution`)}
            className="glass-card rounded-2xl p-4 text-left hover:bg-violet-500/10 transition-colors"
          >
            <div className="text-2xl mb-1">📈</div>
            <div className="text-sm font-medium text-white">{t('my_evolution')}</div>
          </button>
        </div>
      </div>
    </div>
  );
}
