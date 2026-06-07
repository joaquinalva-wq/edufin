'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, formatPercent } from '@/lib/utils';
import { RANDOM_EVENTS, INVESTMENTS, PRODUCTS, MATERIAL_COST_MULTIPLIERS, SUPPLIER_COST_MULTIPLIERS, EMPLOYEE_DAILY_COST, LOCATIONS } from '@/constants';
import { FeedbackCard } from '@/components/game/FeedbackCard';
import { Button } from '@/components/ui/button';
import { StudentShell } from '@/components/shared/StudentShell';
import {
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import type { Round, Company } from '@/types';

// Flat message map for feedback interpolation
const MESSAGE_MAP: Record<string, string> = {
  // Product-location fit
  'feedback.great_fit.title': '¡Excelente fit producto-ubicación!',
  'feedback.great_fit.msg': 'Tu producto encaja muy bien aquí (índice: {fit}/1.40). Esto amplificó tu demanda significativamente.',
  'feedback.poor_fit.title': 'Mala combinación producto-ubicación',
  'feedback.poor_fit.msg': 'Fit de {fit}/1.40 — tu producto no encaja bien aquí. Esto redujo tu demanda potencial. (No podés cambiar la ubicación, pero sí entender por qué.)',
  'feedback.poor_fit.learn': 'Cada producto tiene ubicaciones ideales. Las bicis funcionan mejor en zonas residenciales (commuters), los skates en universidades (cultura urbana). La combinación puede multiplicar o dividir tu demanda hasta 2×.',

  // Stock management
  'feedback.stock_out.title': '¡La demanda superó tu stock!',
  'feedback.stock_out.msg': 'La demanda fue {demand} unidades pero tenías solo {produced} en stock. Perdiste {units} ventas potenciales (~${lost}). Próximo mes: considerá producir al menos {suggested} unidades.',
  'feedback.stock_out.learn': 'Quedarse sin stock pierde ventas inmediatas y reduce la satisfacción del cliente, lo que impacta negativamente en rondas futuras.',
  'feedback.overstock.title': 'Sobreproducción',
  'feedback.overstock.msg': 'Produjiste {produced} unidades pero la demanda real fue {demand} (vendiste {sold}). Te sobraron {units} unidades sin vender. Próximo mes: apuntá a {suggestedMin}–{suggestedMax} unidades.',

  // Liquidity
  'feedback.liquidity_crisis.title': '⚠️ Crisis de liquidez',
  'feedback.liquidity_crisis.msg': 'Tu capital cayó por debajo del 15% del inicial. El próximo mes operarás con penalización de eficiencia.',
  'feedback.liquidity_crisis.learn': 'La liquidez es el oxígeno de la empresa. Sin reservas, no podés reaccionar a imprevistos ni aprovechar oportunidades.',

  // Marketing
  'feedback.no_marketing.title': 'Sin inversión en marketing',
  'feedback.no_marketing.msg': 'Con $0 en marketing, tu demanda base tiene un penalizador de ×0.72. El marketing no es gasto: construye demanda futura.',
  'feedback.no_marketing.learn': 'El marketing incrementa la visibilidad de tu marca. Sin él, la demanda base cae un 28%. Con $5.000–$10.000, el efecto ya es significativo.',
  'feedback.great_marketing.title': '¡Marketing efectivo!',
  'feedback.great_marketing.msg': 'Tu campaña amplificó la demanda un {effect}% por encima de la base. Buen retorno sobre inversión.',

  // Quality
  'feedback.quality_mismatch.title': 'Incoherencia calidad–posicionamiento',
  'feedback.quality_mismatch.msg': 'Usás materiales económicos con posicionamiento premium. Tus clientes perciben la diferencia y eso erosiona tu marca gradualmente.',
  'feedback.quality_mismatch.learn': 'Los clientes premium están dispuestos a pagar más, pero exigen calidad real. Esta incoherencia reduce tu satisfacción del cliente cada ronda.',

  // Profitability
  'feedback.profitable.title': '¡Mes rentable!',
  'feedback.profitable.msg': 'Tu capital creció un {pct}% este mes. Las decisiones de producción, precio y costos se combinaron positivamente.',

  // Loss — root-cause variants
  'feedback.loss.title': 'Mes con pérdida (−${loss})',
  'feedback.loss.msg_price': 'Tu precio de venta no cubre el costo variable por unidad. Cada unidad que vendés genera pérdida bruta. Subí el precio o usá materiales más económicos.',
  'feedback.loss.msg_volume': 'Para cubrir tus costos fijos de ${costs}, necesitabas vender {breakEven} unidades. Solo vendiste {sold}. Aumentá producción, mejorámarketing o reducí costos fijos.',
  'feedback.loss.msg_costs': 'Tus costos operativos (${costs}) superaron los ingresos. Revisá si el gasto en marketing, empleados o mejoras del local es proporcional a lo que vendés.',
  'feedback.loss.learn': 'Las pérdidas tienen causas específicas: precio bajo (no cubre costos variables), volumen bajo (no se alcanza el punto de equilibrio), o costos excesivos. Identificar cuál aplica cambia la solución.',

  // Staffing
  'feedback.understaffed.title': 'Capacidad operativa limitada',
  'feedback.understaffed.msg': 'Pocos empleados para la complejidad de tu producto. La eficiencia operativa baja limita cuántas unidades podés vender, incluso si hay demanda.',

  // Price vs cost
  'feedback.price_below_cost.title': 'El precio no cubre el costo de producción',
  'feedback.price_below_cost.msg': 'Precio de venta: ${price} · Costo variable por unidad: ${varCost}. Cada unidad vendida genera pérdida de ${varCost} − ${price}. Subí el precio urgente.',
  'feedback.price_below_cost.learn': 'El margen bruto (precio − costo variable) debe ser positivo para que tenga sentido producir. Un precio bajo el costo significa pérdida estructural en ventas.',

  // Break-even tip
  'feedback.close_breakeven.title': 'Cerca del punto de equilibrio',
  'feedback.close_breakeven.msg': 'Vendiste {sold} unidades y el punto de equilibrio era {breakEven}. Un pequeño incremento en ventas o reducción de costos fijos mejoraría bastante el resultado.',
};

const PIE_COLORS = ['#ef4444', '#7c3aed', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'];

export default function ResultsPage({ params }: { params: { locale: string; roundId: string } }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { locale, roundId } = params;

  const [round, setRound] = useState<Round | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push(`/${locale}/login`);
  }, [user, loading, locale, router]);

  useEffect(() => {
    if (!roundId) return;
    getDoc(doc(db, 'rounds', roundId)).then(async snap => {
      if (snap.exists()) {
        const r = { id: snap.id, ...snap.data() } as Round;
        setRound(r);
        if (r.companyId) {
          const compSnap = await getDoc(doc(db, 'companies', r.companyId));
          if (compSnap.exists()) setCompany({ id: compSnap.id, ...compSnap.data() } as Company);
        }
      }
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

        {/* Financial Metrics */}
        {(() => {
          const grossMarginPct = r.revenue > 0 ? (r.grossProfit / r.revenue) * 100 : null;
          const netMarginPct = r.revenue > 0 ? (r.netProfit / r.revenue) * 100 : null;
          const burnRate = (r.totalOperatingCosts / r.startingCapital) * 100;
          const capitalEfficiency = r.totalOperatingCosts > 0 ? r.revenue / r.totalOperatingCosts : null;

          // Break-even using company+product data when available
          let breakEvenUnits: number | null = null;
          let variableCostPerUnit: number | null = null;
          if (company && round.decision) {
            const product = PRODUCTS[company.productId];
            const location = LOCATIONS[company.locationId];
            if (product && location && round.decision) {
              const d = round.decision;
              const matMult = MATERIAL_COST_MULTIPLIERS[d.materialQuality] ?? 1;
              const supMult = SUPPLIER_COST_MULTIPLIERS[d.supplierId] ?? 1;
              variableCostPerUnit = product.unitCost * matMult * supMult;
              const marginPerUnit = d.price - variableCostPerUnit;
              if (marginPerUnit > 0) {
                const fixedCosts = location.rentPerRound
                  + d.employeeCount * (EMPLOYEE_DAILY_COST[d.employeeType] ?? 3200)
                  + d.trainingBudget + d.motivationBonus
                  + d.marketingBudget + d.localImprovementBudget + d.marketResearchBudget;
                breakEvenUnits = Math.ceil(fixedCosts / marginPerUnit);
              }
            }
          }

          return (
            <div className="glass-card rounded-2xl p-4">
              <h3 className="font-bold text-white mb-1">📐 Métricas financieras clave</h3>
              <p className="text-[11px] text-white/30 mb-3">Conceptos que se usan en contabilidad y finanzas reales</p>
              <div className="grid grid-cols-2 gap-3 mb-3">
                {[
                  {
                    emoji: '💰', label: 'Margen bruto',
                    value: grossMarginPct !== null ? `${grossMarginPct.toFixed(1)}%` : 'N/A',
                    sublabel: 'ventas − costo de producción',
                    color: (grossMarginPct ?? 0) > 0 ? 'text-emerald-400' : 'text-red-400',
                    tip: 'Cuánto queda de cada $1 vendido, antes de otros gastos.',
                  },
                  {
                    emoji: '📊', label: 'Margen neto',
                    value: netMarginPct !== null ? `${netMarginPct.toFixed(1)}%` : 'N/A',
                    sublabel: 'incluye todos los costos',
                    color: (netMarginPct ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400',
                    tip: 'El margen real de ganancia después de pagar todo.',
                  },
                  {
                    emoji: '🔥', label: 'Burn rate',
                    value: `${burnRate.toFixed(1)}%`,
                    sublabel: 'del capital consumido en ops',
                    color: burnRate > 80 ? 'text-red-400' : burnRate > 60 ? 'text-amber-400' : 'text-emerald-400',
                    tip: 'Qué porcentaje de tu capital usaste en operar este mes.',
                  },
                  {
                    emoji: '⚡', label: 'Eficiencia de capital',
                    value: capitalEfficiency !== null ? `${capitalEfficiency.toFixed(2)}×` : 'N/A',
                    sublabel: '$ de ingreso por $ gastado',
                    color: (capitalEfficiency ?? 0) >= 1 ? 'text-emerald-400' : 'text-red-400',
                    tip: 'Cuántos pesos de ingreso generaste por cada peso que gastaste.',
                  },
                ].map(({ emoji, label, value, sublabel, color, tip }) => (
                  <div key={label} className="bg-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span>{emoji}</span>
                      <span className="text-[11px] text-white/50">{label}</span>
                    </div>
                    <div className={`text-xl font-black ${color}`}>{value}</div>
                    <div className="text-[10px] text-white/30 mt-0.5">{sublabel}</div>
                    <details className="mt-1.5">
                      <summary className="text-[10px] text-white/25 cursor-pointer hover:text-white/50">¿Qué es? →</summary>
                      <p className="text-[10px] text-white/40 mt-1 leading-relaxed">{tip}</p>
                    </details>
                  </div>
                ))}
              </div>

              {/* Break-even analysis */}
              {breakEvenUnits !== null && (
                <div className={`rounded-xl p-3 ${r.unitsSold >= breakEvenUnits ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-white/70">Punto de equilibrio (break-even)</span>
                    <span className={`text-sm font-black ${r.unitsSold >= breakEvenUnits ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {r.unitsSold} / {breakEvenUnits} unidades
                    </span>
                  </div>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${r.unitsSold >= breakEvenUnits ? 'bg-emerald-500' : 'bg-amber-500'}`}
                      style={{ width: `${Math.min(100, (r.unitsSold / breakEvenUnits) * 100)}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-white/30 mt-1.5">
                    {r.unitsSold >= breakEvenUnits
                      ? `✅ Superaste el punto de equilibrio. Vendiste ${r.unitsSold - breakEvenUnits} unidades extra de ganancia pura.`
                      : `Te faltaron ${breakEvenUnits - r.unitsSold} unidades para cubrir todos los costos fijos.`}
                  </p>
                </div>
              )}
            </div>
          );
        })()}

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
