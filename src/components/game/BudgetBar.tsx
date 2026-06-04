'use client';

import { formatCurrency } from '@/lib/utils';
import { clamp } from '@/lib/utils';

interface BudgetBarProps {
  capital: number;
  rent: number;
  allocated: number;
  investments: number;
}

export function BudgetBar({ capital, rent, allocated, investments }: BudgetBarProps) {
  const totalUsed = rent + allocated + investments;
  const liquid = capital - totalUsed;
  const isOver = liquid < 0;
  const isLow = !isOver && liquid < capital * 0.10;

  const rentPct   = clamp((rent / capital) * 100, 0, 100);
  const allocPct  = clamp((allocated / capital) * 100, 0, 100);
  const invPct    = clamp((investments / capital) * 100, 0, 100);
  const liqPct    = clamp(Math.max(0, (liquid / capital)) * 100, 0, 100);

  return (
    <div className="glass border-b border-white/10 px-4 py-3 sticky top-0 z-40">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-baseline mb-2">
          <span className="text-xs font-medium text-white/60">Capital disponible</span>
          <span className={`text-sm font-bold ${isOver ? 'text-red-400' : isLow ? 'text-amber-400' : 'text-white'}`}>
            {isOver ? `⚠️ −${formatCurrency(Math.abs(liquid), true)} EXCEDIDO` : `Libre: ${formatCurrency(liquid, true)}`}
          </span>
        </div>

        {/* Stacked bar */}
        <div className="h-3 rounded-full bg-white/10 overflow-hidden flex">
          <div className="h-full bg-red-500/60 transition-all duration-300"     style={{ width: `${rentPct}%` }}   title={`Alquiler: ${formatCurrency(rent, true)}`} />
          <div className="h-full bg-violet-500 transition-all duration-300"     style={{ width: `${allocPct}%` }}  title={`Operaciones: ${formatCurrency(allocated, true)}`} />
          <div className="h-full bg-amber-500 transition-all duration-300"      style={{ width: `${invPct}%` }}    title={`Inversiones: ${formatCurrency(investments, true)}`} />
          <div className="h-full bg-emerald-500/30 transition-all duration-300" style={{ width: `${liqPct}%` }}   />
        </div>

        {/* Legend */}
        <div className="flex gap-3 mt-1.5 flex-wrap">
          {[
            { color: 'bg-red-500/60',     label: 'Alquiler',     val: rent },
            { color: 'bg-violet-500',     label: 'Operaciones',  val: allocated },
            { color: 'bg-amber-500',      label: 'Inversiones',  val: investments },
            { color: 'bg-emerald-500/50', label: 'Liquidez',     val: Math.max(0, liquid) },
          ].map(({ color, label, val }) => (
            <div key={label} className="flex items-center gap-1">
              <div className={`w-2 h-2 rounded-full ${color}`} />
              <span className="text-[10px] text-white/50">{label}: {formatCurrency(val, true)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
