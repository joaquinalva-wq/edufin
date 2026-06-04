'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc, collection, query, where, orderBy, limit, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';
import { useDecisionStore } from '@/store/decisionStore';
import {
  PRODUCTS, LOCATIONS,
  MATERIAL_COST_MULTIPLIERS, SUPPLIER_COST_MULTIPLIERS,
  EMPLOYEE_DAILY_COST, MARKET_RESEARCH_COSTS,
  INVESTMENT_LIST, MARKETING_CHANNELS,
  MARKETING_QUALITY_MULTIPLIER,
} from '@/constants';
import { formatCurrency } from '@/lib/utils';
import { BudgetBar } from '@/components/game/BudgetBar';
import { Slider, Stepper } from '@/components/ui/slider';
import { OptionPicker, MultiPicker, SectionCard } from '@/components/game/OptionPicker';
import { Button } from '@/components/ui/button';
import { StudentShell } from '@/components/shared/StudentShell';
import type { Company, Round, InvestmentAllocation } from '@/types';

export default function DecisionsPage({ params }: { params: { locale: string } }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const locale = params.locale;
  const store = useDecisionStore();

  const [company, setCompany] = useState<Company | null>(null);
  const [round, setRound] = useState<Round | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.push(`/${locale}/login`);
  }, [user, loading, locale, router]);

  useEffect(() => {
    if (!user?.activeCompanyId) { setPageLoading(false); return; }
    async function load() {
      const compSnap = await getDoc(doc(db, 'companies', user!.activeCompanyId!));
      if (!compSnap.exists()) { setPageLoading(false); return; }
      const comp = { id: compSnap.id, ...compSnap.data() } as Company;
      setCompany(comp);
      store.setAvailableCapital(comp.currentCapital);

      const q = query(
        collection(db, 'rounds'),
        where('companyId', '==', comp.id),
        where('status', 'in', ['open', 'locked']),
        orderBy('roundNumber', 'desc'),
        limit(1)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const r = { id: snap.docs[0].id, ...snap.docs[0].data() } as Round;
        setRound(r);
        if (r.status === 'locked') setSubmitted(true);
        if (r.decision) {
          // Pre-fill with saved draft
          store.update(r.decision);
        } else {
          // Set default price to midpoint
          const product = PRODUCTS[comp.productId];
          store.setPrice(Math.round((product.minPrice + product.maxPrice) / 2));
        }
      }
      setPageLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const product = company ? PRODUCTS[company.productId] : null;
  const location = company ? LOCATIONS[company.locationId] : null;
  const d = store.draft;

  // Real-time cost calculation
  const costs = useMemo(() => {
    if (!product) return { production: 0, employees: 0, ops: 0, investments: 0 };
    const matMult = MATERIAL_COST_MULTIPLIERS[d.materialQuality ?? 'medium'] ?? 1;
    const supMult = SUPPLIER_COST_MULTIPLIERS[d.supplierId ?? 'standard'] ?? 1;
    const production = (d.unitsProduced ?? 0) * product.unitCost * matMult * supMult;
    const empBase = (d.employeeCount ?? 1) * (EMPLOYEE_DAILY_COST[d.employeeType ?? 'balanced'] ?? 3200);
    const employees = empBase + (d.trainingBudget ?? 0) + (d.motivationBonus ?? 0);
    const ops = (d.marketingBudget ?? 0) + (d.localImprovementBudget ?? 0) + (d.marketResearchBudget ?? 0);
    const investments = (d.investments ?? []).reduce((s, i) => s + i.amount, 0);
    return { production, employees, ops, investments };
  }, [d, product]);

  const allocated = costs.production + costs.employees + costs.ops;
  const rent = location?.rentPerRound ?? 0;

  async function autosaveDraft() {
    if (!round || round.status !== 'open' || !company) return;
    const decision = {
      ...d,
      totalAllocated: allocated + costs.investments + rent,
      liquidityRetained: (company.currentCapital - allocated - costs.investments - rent),
    };
    try {
      await updateDoc(doc(db, 'rounds', round.id), { decision, updatedAt: new Date() });
    } catch { /* silent */ }
  }

  async function handleSubmit() {
    if (!round || !company) return;
    setSaving(true);
    try {
      const decision = {
        ...d,
        totalAllocated: allocated + costs.investments + rent,
        liquidityRetained: Math.max(0, company.currentCapital - allocated - costs.investments - rent),
      };
      await updateDoc(doc(db, 'rounds', round.id), {
        decision,
        status: 'locked',
        updatedAt: new Date(),
      });
      setSubmitted(true);
    } finally {
      setSaving(false);
    }
  }

  function setInvestment(id: string, amount: number) {
    const current = (d.investments ?? []).filter(i => i.investmentId !== id);
    if (amount > 0) current.push({ investmentId: id as InvestmentAllocation['investmentId'], amount });
    store.setInvestments(current);
  }

  const overBudget = allocated + costs.investments + rent > (company?.currentCapital ?? 0);

  if (pageLoading) return (
    <StudentShell locale={locale}>
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-5xl animate-bounce-subtle">⏳</div>
      </div>
    </StudentShell>
  );

  if (!round) return (
    <StudentShell locale={locale}>
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass-card rounded-3xl p-8 text-center max-w-sm">
          <div className="text-4xl mb-3">🕐</div>
          <h2 className="text-lg font-bold text-white mb-2">No hay ronda activa</h2>
          <p className="text-white/50 text-sm">Esperá que el juego inicie una nueva ronda.</p>
        </div>
      </div>
    </StudentShell>
  );

  if (submitted) return (
    <StudentShell locale={locale}>
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass-card rounded-3xl p-8 text-center max-w-sm animate-slide-up">
          <div className="text-5xl mb-4 animate-bounce-subtle">✅</div>
          <h2 className="text-xl font-bold text-white mb-2">¡Decisiones enviadas!</h2>
          <p className="text-white/50 text-sm mb-1">Los resultados estarán disponibles mañana.</p>
          <p className="text-white/30 text-xs mb-6">Ronda {round.roundNumber} cerrada.</p>
          <Button variant="secondary" onClick={() => router.push(`/${locale}/dashboard`)}>
            Volver al inicio
          </Button>
        </div>
      </div>
    </StudentShell>
  );

  if (!product || !location) return null;

  return (
    <StudentShell locale={locale}>
      <div className="min-h-screen pb-32">
        {/* Sticky budget bar */}
        <BudgetBar
          capital={company?.currentCapital ?? 0}
          rent={rent}
          allocated={allocated}
          investments={costs.investments}
        />

        <div className="max-w-2xl mx-auto p-4 flex flex-col gap-4 mt-4">

          {/* Round header */}
          <div className="text-center animate-slide-up">
            <h1 className="text-2xl font-bold gradient-text">Decisiones — Ronda {round.roundNumber}</h1>
            <p className="text-white/50 text-sm mt-1">
              {product.emoji} {product.id} · {location.emoji} {location.id} · Cierra: {new Date(round.closeAt instanceof Date ? round.closeAt : (round.closeAt as { seconds: number }).seconds * 1000).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>

          {/* 1. Producción */}
          <SectionCard title="Producción y Materiales" emoji="🏭">
            <Stepper
              label={`Unidades a producir (costo base: ${formatCurrency(product.unitCost)}/u)`}
              value={d.unitsProduced ?? 0}
              min={0}
              max={200}
              onChange={store.setUnitsProduced}
              hint={`Costo de producción: ${formatCurrency(costs.production, true)}`}
            />
            <OptionPicker
              value={d.materialQuality ?? 'medium'}
              onChange={v => store.setMaterialQuality(v as 'cheap' | 'medium' | 'premium')}
              options={[
                { value: 'cheap',   emoji: '📦', label: 'Económicos',  sublabel: '−22% costo, −25% calidad' },
                { value: 'medium',  emoji: '⭐', label: 'Estándar',   sublabel: 'Equilibrado'  },
                { value: 'premium', emoji: '💎', label: 'Premium',    sublabel: '+32% costo, +25% calidad' },
              ]}
            />
            <OptionPicker
              value={d.supplierId ?? 'standard'}
              onChange={v => store.setSupplier(v as 'budget' | 'standard' | 'premium')}
              options={[
                { value: 'budget',   emoji: '💰', label: 'Económico',     sublabel: '−15% costo, −20% fiabilidad' },
                { value: 'standard', emoji: '🤝', label: 'Estándar',      sublabel: 'Equilibrado'  },
                { value: 'premium',  emoji: '🏆', label: 'Alta calidad',  sublabel: '+20% costo, +15% fiabilidad' },
              ]}
            />
          </SectionCard>

          {/* 2. Precio */}
          <SectionCard title="Precio de venta" emoji="💲">
            <Slider
              label="Precio unitario"
              value={d.price ?? product.minPrice}
              min={product.minPrice}
              max={product.maxPrice}
              step={50}
              onChange={store.setPrice}
              hint={`Rango: ${formatCurrency(product.minPrice)} – ${formatCurrency(product.maxPrice)}`}
            />
            {d.price && d.unitsProduced ? (
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Margen bruto', val: d.price - product.unitCost, pct: true },
                  { label: 'Ingreso potencial', val: d.price * d.unitsProduced },
                  { label: 'Precio/costo', val: (d.price / product.unitCost), pct: true, mult: true },
                ].map(({ label, val, pct, mult }) => (
                  <div key={label} className="bg-white/5 rounded-xl p-2">
                    <div className={`text-sm font-bold ${val > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {mult ? `${val.toFixed(1)}×` : pct ? formatCurrency(val, true) : formatCurrency(val, true)}
                    </div>
                    <div className="text-[10px] text-white/40">{label}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </SectionCard>

          {/* 3. Local y Operaciones */}
          <SectionCard title="Local y Operaciones" emoji="🏪">
            <div className="text-xs text-white/40 -mt-2">
              Alquiler fijo: {formatCurrency(rent)} / ronda (no modificable)
            </div>
            <Slider label="Inversión en mejoras del local" value={d.localImprovementBudget ?? 0} min={0} max={15000} step={500} onChange={store.setLocalImprovementBudget}
              hint="Acumula beneficios en rondas futuras (reputación, flujo de clientes)" />
            <OptionPicker value={d.serviceLevel ?? 'standard'} onChange={v => store.setServiceLevel(v as 'basic' | 'standard' | 'premium')}
              options={[
                { value: 'basic',    emoji: '🪑', label: 'Básico',    sublabel: '−15% cap. operativa' },
                { value: 'standard', emoji: '👌', label: 'Estándar',  sublabel: 'Equilibrado'         },
                { value: 'premium',  emoji: '✨', label: 'Premium',   sublabel: '+20% satisfacción'   },
              ]}
            />
            <div className="grid grid-cols-2 gap-4">
              <Slider label="Horas de apertura / día" value={d.openingHours ?? 10} min={6} max={16} step={1}
                onChange={store.setOpeningHours} formatValue={v => `${v} hs`} />
              <Slider label="Días abierto / semana" value={d.daysOpen ?? 6} min={5} max={7} step={1}
                onChange={store.setDaysOpen} formatValue={v => `${v} días`} />
            </div>
          </SectionCard>

          {/* 4. Marketing */}
          <SectionCard title="Marketing y Branding" emoji="📣">
            <Slider label="Presupuesto de marketing" value={d.marketingBudget ?? 0} min={0} max={40000} step={500}
              onChange={store.setMarketingBudget} hint="Rendimiento decreciente: duplicar presupuesto ≠ doble demanda" />
            <OptionPicker value={d.marketingQuality ?? 'basic'} onChange={v => store.setMarketingQuality(v as 'basic' | 'professional' | 'creative')}
              options={[
                { value: 'basic',        emoji: '📝', label: 'Básica',        sublabel: `×${MARKETING_QUALITY_MULTIPLIER.basic}` },
                { value: 'professional', emoji: '🎯', label: 'Profesional',   sublabel: `×${MARKETING_QUALITY_MULTIPLIER.professional}` },
                { value: 'creative',     emoji: '🎨', label: 'Creativa',      sublabel: `×${MARKETING_QUALITY_MULTIPLIER.creative}` },
              ]}
            />
            <div>
              <p className="text-sm font-medium text-white/80 mb-2">Canales de marketing</p>
              <MultiPicker
                values={d.marketingChannels ?? []}
                onChange={store.setMarketingChannels}
                max={4}
                options={MARKETING_CHANNELS.map(c => ({ value: c, label: c.replace(/_/g, ' ') }))}
              />
            </div>
            <OptionPicker value={d.positioning ?? 'quality_price'} onChange={v => store.setPositioning(v as 'budget' | 'quality_price' | 'premium' | 'sustainable' | 'sports' | 'youth')}
              columns={3}
              options={[
                { value: 'budget',        emoji: '💸', label: 'Económico'     },
                { value: 'quality_price', emoji: '⚖️', label: 'Calidad-Precio' },
                { value: 'premium',       emoji: '👑', label: 'Premium'       },
                { value: 'sustainable',   emoji: '🌿', label: 'Sustentable'   },
                { value: 'sports',        emoji: '⚽', label: 'Deportivo'     },
                { value: 'youth',         emoji: '🛹', label: 'Juvenil/Urbano' },
              ]}
            />
          </SectionCard>

          {/* 5. Empleados */}
          <SectionCard title="Equipo de trabajo" emoji="👥">
            <Stepper label={`Empleados (mín. recomendado: ${product.minEmployees})`}
              value={d.employeeCount ?? 1} min={1} max={10} onChange={store.setEmployeeCount}
              hint={`Costo base: ${formatCurrency((d.employeeCount ?? 1) * (EMPLOYEE_DAILY_COST[d.employeeType ?? 'balanced']), true)}/ronda`}
            />
            <OptionPicker value={d.employeeType ?? 'balanced'} onChange={v => store.setEmployeeType(v as 'cheap' | 'balanced' | 'expert')}
              options={[
                { value: 'cheap',    emoji: '👤', label: 'Inexpertos',  sublabel: `$${EMPLOYEE_DAILY_COST.cheap.toLocaleString()}/ronda · ×0.6 prod.` },
                { value: 'balanced', emoji: '👤', label: 'Equilibrados', sublabel: `$${EMPLOYEE_DAILY_COST.balanced.toLocaleString()}/ronda · ×1.0 prod.` },
                { value: 'expert',   emoji: '⭐', label: 'Expertos',    sublabel: `$${EMPLOYEE_DAILY_COST.expert.toLocaleString()}/ronda · ×1.4 prod.` },
              ]}
            />
            <Slider label="Presupuesto de capacitación" value={d.trainingBudget ?? 0} min={0} max={10000} step={500}
              onChange={store.setTrainingBudget} hint="Mejora la productividad a lo largo de varias rondas" />
            <Slider label="Bono motivacional" value={d.motivationBonus ?? 0} min={0} max={8000} step={500}
              onChange={store.setMotivationBonus} hint="Aumenta el desempeño esta ronda en particular" />
          </SectionCard>

          {/* 6. Investigación de mercado */}
          <SectionCard title="Investigación de mercado" emoji="🔍" defaultOpen={false}>
            <p className="text-xs text-white/50">Invertí para obtener información sobre la próxima ronda. Es costosa — considerá si vale la pena.</p>
            <OptionPicker
              value={d.marketResearchLevel ?? ''}
              onChange={v => {
                if (v === '') { store.setMarketResearch(undefined, 0); return; }
                const lv = v as 'basic' | 'standard' | 'premium';
                store.setMarketResearch(lv, MARKET_RESEARCH_COSTS[lv]);
              }}
              columns={2}
              options={[
                { value: '',         emoji: '❌', label: 'No investigar',   sublabel: 'Gratis' },
                { value: 'basic',    emoji: '🔍', label: 'Básica',          sublabel: `$${MARKET_RESEARCH_COSTS.basic.toLocaleString()} · 1 insight` },
                { value: 'standard', emoji: '📊', label: 'Estándar',        sublabel: `$${MARKET_RESEARCH_COSTS.standard.toLocaleString()} · 3 insights` },
                { value: 'premium',  emoji: '🧠', label: 'Premium',         sublabel: `$${MARKET_RESEARCH_COSTS.premium.toLocaleString()} · 5 insights + evento` },
              ]}
            />
          </SectionCard>

          {/* 7. Inversiones financieras */}
          <SectionCard title="Inversiones financieras" emoji="📈" defaultOpen={false}>
            <p className="text-xs text-white/50">El dinero que no usás en el negocio puede invertirse. Mayor riesgo = mayor retorno potencial.</p>
            <div className="flex flex-col gap-3">
              {INVESTMENT_LIST.map(inv => {
                const current = (d.investments ?? []).find(i => i.investmentId === inv.id);
                const val = current?.amount ?? 0;
                const riskColors: Record<string, string> = {
                  very_low: 'text-gray-400', low: 'text-emerald-400',
                  medium: 'text-amber-400', high: 'text-orange-400', very_high: 'text-red-400',
                };
                return (
                  <div key={inv.id} className="bg-white/5 rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xl">{inv.emoji}</span>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-white">{inv.id.replace(/_/g, ' ')}</div>
                        <div className="flex gap-2 text-[10px]">
                          <span className={riskColors[inv.riskLevel]}>Riesgo: {inv.riskLevel.replace('_', ' ')}</span>
                          <span className="text-emerald-400">Retorno esp: {(inv.expectedReturn * 100).toFixed(1)}%/ronda</span>
                        </div>
                      </div>
                    </div>
                    <Slider
                      label={`Invertir en ${inv.id.replace(/_/g, ' ')}`}
                      value={val}
                      min={0}
                      max={Math.min(50000, company?.currentCapital ?? 50000)}
                      step={1000}
                      onChange={amount => setInvestment(inv.id, amount)}
                      hint={val > 0 ? `Retorno esperado: +${formatCurrency(val * inv.expectedReturn, true)} (puede variar mucho)` : undefined}
                    />
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* Submit */}
          <div className="glass-card rounded-2xl p-4 mt-2">
            {overBudget && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-3 text-red-400 text-sm">
                ⚠️ Excediste el presupuesto. Reducí alguna inversión antes de confirmar.
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Button variant="secondary" onClick={autosaveDraft} className="w-full">
                💾 Guardar borrador
              </Button>
              <Button variant="gradient" size="lg" className="w-full" loading={saving} disabled={overBudget} onClick={handleSubmit}>
                ✅ Confirmar decisiones
              </Button>
            </div>
            <p className="text-xs text-white/30 text-center mt-2">
              Una vez confirmadas no se pueden modificar hasta la próxima ronda.
            </p>
          </div>

        </div>
      </div>
    </StudentShell>
  );
}
