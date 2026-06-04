'use client';

import { cn } from '@/lib/utils';
import { formatCurrency } from '@/lib/utils';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  formatValue?: (v: number) => string;
  color?: string;
  hint?: string;
  disabled?: boolean;
}

export function Slider({
  label, value, min, max, step = 500, onChange, formatValue, color = 'violet', hint, disabled,
}: SliderProps) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  const display = formatValue ? formatValue(value) : formatCurrency(value);

  return (
    <div className={cn('flex flex-col gap-2', disabled && 'opacity-50 pointer-events-none')}>
      <div className="flex justify-between items-baseline">
        <label className="text-sm font-medium text-white/80">{label}</label>
        <span className="text-sm font-bold text-white">{display}</span>
      </div>
      <div className="relative h-2 rounded-full bg-white/10">
        <div
          className="absolute h-full rounded-full transition-all duration-100"
          style={{ width: `${pct}%`, backgroundColor: `var(--color-${color}, #7c3aed)` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-lg border-2 pointer-events-none transition-all duration-100"
          style={{ left: `calc(${pct}% - 8px)`, borderColor: `var(--color-${color}, #7c3aed)` }}
        />
      </div>
      {hint && <p className="text-xs text-white/40">{hint}</p>}
    </div>
  );
}

interface StepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  hint?: string;
}

export function Stepper({ label, value, min, max, onChange, hint }: StepperProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center">
        <label className="text-sm font-medium text-white/80">{label}</label>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange(Math.max(min, value - 1))}
            className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-bold transition-colors"
          >
            −
          </button>
          <span className="w-8 text-center font-bold text-white">{value}</span>
          <button
            type="button"
            onClick={() => onChange(Math.min(max, value + 1))}
            className="w-7 h-7 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition-colors"
          >
            +
          </button>
        </div>
      </div>
      {hint && <p className="text-xs text-white/40">{hint}</p>}
    </div>
  );
}
