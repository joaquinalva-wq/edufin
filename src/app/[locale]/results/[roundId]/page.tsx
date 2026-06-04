'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { RANDOM_EVENTS, INVESTMENTS } from '@/constants';
import { FeedbackCard } from '@/components/game/FeedbackCard';
import { Button } from '@/components/ui/button';
import { StudentShell } from '@/components/shared/StudentShell';
import {
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import type { Round } from '@/types';

// Flat message map for feedback interpolation
const MESSAGE_MAP: Record<string, string> = {
  'feedback.great_fit.title': '¡Excelente combinación!',
  'feedback.great_fit.msg': 'Tu producto funciona muy bien en esta ubicación (fit: {fit}).',
  'feedback.poor_fit.title': 'Mala combinación producto-ubicación',
  'feedback.poor_fit.msg': 'Tu producto no encaja bien en este lugar (fit: {fit}).',
  'feedback.poor_fit.learn': 'La compatibilidad entre producto y ubicación puede multiplicar o dividir tu demanda.',
  'feedback.stock_out.title': '¡Te quedaste sin stock!',
  'feedback.stock_out.msg': 'Perdiste {units} ventas potenciales (aprox. ${lost}).',
  'feedback.stock_out.learn': 'Quedarse sin stock pierde ventas y reduce la satisfacción del cliente.',
  'feedback.overstock.title': 'Sobrestock',
  'feedback.overstock.msg': 'Te sobraron {units} unidades. Ajustá la producción.',
  'feedback.liquidity_crisis.title': '⚠️ Crisis de liquidez',
  'feedback.liquidity_crisis.msg': 'Tu capital cayó por debajo del 15%. El próximo mes tendrá penalización.',
  'feedback.liquidity_crisis.learn': 'Siempre reservá liquidez para emergencias.',
  'feedback.no_marketing.title': 'Sin marketing',
  'feedback.no_marketing.msg': 'Sin marketing, tu demanda base cae significativamente.',
  'feedback.no_marketing.learn': 'El marketing no es gasto: es inversión en demanda futura.',
  'feedback.great_marketing.title': '¡Marketing efectivo!',
  'feedback.great_marketing.msg': 'Tu campaña boosteó la demanda un {effect}% por encima de la base.',
  'feedback.quality_mismatch.title': 'Incoherencia de calidad',
  'feedback.quality_mismatch.msg': 'Materiales baratos con posicionamiento premium erosionan tu marca.',
  'feedback.quality_mismatch.learn': 'Los clientes premium esperan calidad real.',
  'feedback.profitable.title': '¡Mes rentable!',
  'feedback.profitable.msg': 'Tu capital creció un {pct}% este mes. ¡Muy bien!',
  'feedback.loss.title': 'Mes con pérdida',
  'feedback.loss.msg': 'Perdiste ${loss} este mes. Analizá los costos.',
  'feedback.loss.learn': 'Las pérdidas ocasionales son normales. Lo importante es aprender qué las causó.',
  'feedback.understaffed.title': 'Pocos empleados',
  'feedback.understaffed.msg': 'Eficiencia operativa baja por falta de personal.',
};

const PIE_COLORS = ['#ef4444', '#7c3aed', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];

export default function ResultsPage({ params }: { params: { locale: string; roundId: string } }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { locale, roundId } = params;

  const [round, setRound] = useState<Round | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push(`/${locale}/login`);
  }, [user, loading, locale, router]);

  useEffect(() => {
    if (!roundId) return;
    getDoc(doc(db, 'rounds', roundId)).then(snap => {
      if (snap.exists()) setRound({ id: snap.id, ...snap.data() } as Round);
      setPageLoading(false);
    });
  }, [roundId]);

  if (pageLoading) return (
    <StudentShell locale={locale}>
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-5xl animate-bounce-subtle">📊</div>
      </div>
    </StudentShell>
  );

  if (!round?.result) return (
    <StudentShell locale={locale}>
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass-card rounded-3xl p-8 text-center max-w-sm">
          <div className="text-4xl mb-3">⏳</div>
          <p className="text-white/50">Los resultados todavía no están disponibles.</p>
        </div>
      </div>
    </StudentShell>
  );

  const r = round.result;
  const event = RANDOM_EVENTS.find(e => e.id === r.eventId);
  const capitalChange = r.capitalChange;
  const isPositive = capitalChange >= 0;

  // Pie chart data for costs
  const costsData = [
    { name: 'Producción', value: r.productionCost },
    { name: 'Empleados',  value: r.employeeCost   },
    { name: 'Marketing',  value: r.marketingCost  },
    { name: 'Alquiler',   value: r.rentCost       },
    { name: 'Investigación', value: r.researchCost },
    { name: 'Local',      value: r.localCost      },
  ].filter(d => d.value > 0);

  return (
    <StudentShell locale={locale}>
      <div className="max-w-2xl mx-auto p-4 pb-24 flex flex-col gap-4">

        {/* Header */}
        <div className="text-center animate-slide-up pt-4">
          <p className="text-xs text-white/30 mb-1 uppercase tracking-wider">Informe mensual</p>
          <h1 className="text-2xl font-bold gradient-text">Mes {round.roundNumber}</h1>
          <p className="text-white/50 text-sm mt-1">Así le fue a tu empresa este mes</p>
        </div>

        {/* Capital change hero */}
        <div className={`rounded-3xl p-6 text-center border ${isPositive ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
          <p className="text-sm text-white/50 mb-1">Variación de capital</p>
          <p className={`text-5xl font-black ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatPercent(r.capitalChangePct)}
          </p>
          <p className="text-lg font-semibold text-white mt-1">
            {formatCurrency(r.startingCapital)} → {formatCurrency(r.endingCapital)}
          </p>
          <p className="text-sm text-white/40 mt-1">
            Rentabilidad acumulada: <span className={r.cumulativeProfitability >= 0 ? 'text-emerald-400' : 'text-red-400'}>{formatPercent(r.cumulativeProfitability)}</span>
          </p>
        </div>

        {/* Random event */}
        {event && (
          <div className="glass-card rounded-2xl p-4 border border-amber-500/20">
            <p className="text-xs text-amber-400 font-medium mb-1">⚡ Evento del mes</p>
            <div className="flex items-center gap-3">
              <span className="text-3xl">{event.emoji}</span>
              <div>
                <p className="text-sm font-bold text-white">{event.id.replace(/_/g, ' ')}</p>
                <p className="text-xs text-white/50">Modificador de demanda: ×{r.randomEventModifier.toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Sales breakdown */}
        <div className="glass-card rounded-2xl p-4">
          <h3 className="font-bold text-white mb-3">📦 Ventas</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-white/5 rounded-xl p-3">
              <div className="text-2xl font-black text-white">{r.unitsSold}</div>
              <div className="text-xs text-white/40">Unidades vendidas</div>
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <div className="text-2xl font-black text-white/50">{r.potentialDemand}</div>
              <div className="text-xs text-white/40">Demanda potencial</div>
            </div>
            <div className={`rounded-xl p-3 ${r.stockShortfall > 0 ? 'bg-red-500/10' : 'bg-white/5'}`}>
              <div className={`text-2xl font-black ${r.stockShortfall > 0 ? 'text-red-400' : 'text-white'}`}>{r.stockShortfall}</div>
              <div className="text-xs text-white/40">Stock faltante</div>
            </div>
          </div>
        </div>

        {/* P&L */}
        <div className="glass-card rounded-2xl p-4">
          <h3 className="font-bold text-white mb-3">💰 Resultados del mes</h3>
          <div className="flex flex-col gap-2">
            {[
              { label: 'Ingresos por ventas', val: r.revenue, positive: true },
              { label: '− Costos operativos', val: -r.totalOperatingCosts, positive: false },
              { label: '= Ganancia neta', val: r.netProfit, positive: r.netProfit >= 0, bold: true },
              { label: '+ Retorno inversiones', val: r.totalInvestmentNetReturn, positive: r.totalInvestmentNetReturn >= 0 },
            ].map(({ label, val, positive, bold }) => (
              <div key={label} className={`flex justify-between items-center py-1.5 ${bold ? 'border-t border-white/10 pt-2 mt-1' : ''}`}>
                <span className={`text-sm ${bold ? 'font-bold text-white' : 'text-white/60'}`}>{label}</span>
                <span className={`text-sm font-bold ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
                  {val >= 0 ? '+' : ''}{formatCurrency(val, true)}
                </span>
              </div>
            ))}
          </div>

          {/* Costs pie */}
          {costsData.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-white/40 mb-2">Distribución de costos</p>
              <div className="flex items-center gap-4">
                <div className="w-28 h-28 flex-shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={costsData} dataKey="value" cx="50%" cy="50%" outerRadius={50} innerRadius={25}>
                        {costsData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  {costsData.map((d, i) => (
                    <div key={d.name} className="flex justify-between items-center">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="text-xs text-white/60">{d.name}</span>
                      </div>
                      <span className="text-xs text-white font-medium">{formatCurrency(d.value, true)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Investment returns */}
        {r.investmentReturns.filter(ir => ir.amountInvested > 0).length > 0 && (
          <div className="glass-card rounded-2xl p-4">
            <h3 className="font-bold text-white mb-3">📈 Inversiones</h3>
            <div className="flex flex-col gap-2">
              {r.investmentReturns.filter(ir => ir.amountInvested > 0).map(ir => {
                const inv = INVESTMENTS[ir.investmentId];
                return (
                  <div key={ir.investmentId} className="flex items-center justify-between bg-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-2">
                      <span>{inv?.emoji}</span>
                      <div>
                        <div className="text-xs font-medium text-white">{ir.investmentId.replace(/_/g, ' ')}</div>
                        <div className="text-[10px] text-white/40">Invertido: {formatCurrency(ir.amountInvested, true)}</div>
                      </div>
                    </div>
                    <div className={`text-sm font-bold ${ir.netReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {ir.netReturn >= 0 ? '+' : ''}{formatCurrency(ir.netReturn, true)} ({ir.returnPct.toFixed(1)}%)
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Indices */}
        <div className="glass-card rounded-2xl p-4">
          <h3 className="font-bold text-white mb-3">🧮 Tus índices</h3>
          <div className="flex flex-col gap-2.5">
            {[
              { label: 'Fit producto-ubicación', val: r.productLocationFit, max: 1.4, color: 'bg-violet-500' },
              { label: 'Eficiencia operativa',   val: r.operationalEfficiency, max: 1, color: 'bg-blue-500' },
              { label: 'Productividad empleados', val: r.employeeProductivity, max: 1.35, color: 'bg-pink-500' },
              { label: 'Efecto marketing',        val: r.marketingEffect, max: 1.5, color: 'bg-amber-500' },
              { label: 'Satisfacción clientes',   val: r.customerSatisfactionNew, max: 1, color: 'bg-emerald-500' },
              { label: 'Fuerza de marca',         val: r.brandStrengthNew, max: 1, color: 'bg-teal-500' },
            ].map(({ label, val, max, color }) => (
              <div key={label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-white/60">{label}</span>
                  <span className="font-bold text-white">{val.toFixed(2)}</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full">
                  <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${Math.min(100, (val / max) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Feedback educativo */}
        {r.feedbackPoints?.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="font-bold text-white">💡 Análisis del mes — ¿qué impactó en tu empresa?</h3>
            {r.feedbackPoints.map((fp, i) => (
              <FeedbackCard key={i} point={fp} messageMap={MESSAGE_MAP} />
            ))}
          </div>
        )}

        {/* Ranking */}
        {r.rankInGame > 0 && (
          <div className="glass-card rounded-2xl p-4 text-center">
            <p className="text-xs text-white/40 mb-1">Tu posición en el ranking</p>
            <p className="text-4xl font-black gradient-text">#{r.rankInGame}</p>
            <p className="text-sm text-white/50">de {r.totalParticipants} participantes</p>
          </div>
        )}

        {/* Next round */}
        <div className="flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={() => router.push(`/${locale}/leaderboard`)}>
            🏆 Ver ranking
          </Button>
          <Button variant="gradient" className="flex-1" onClick={() => router.push(`/${locale}/dashboard`)}>
            🏠 Inicio
          </Button>
        </div>
      </div>
    </StudentShell>
  );
}
