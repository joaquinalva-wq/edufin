'use client';

import { cn } from '@/lib/utils';

interface Option {
  value: string;
  label: string;
  sublabel?: string;
  emoji?: string;
  cost?: number;
}

interface OptionPickerProps {
  options: Option[];
  value: string;
  onChange: (v: string) => void;
  columns?: 2 | 3 | 4;
}

export function OptionPicker({ options, value, onChange, columns = 3 }: OptionPickerProps) {
  const gridCols = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-4' }[columns];

  return (
    <div className={`grid ${gridCols} gap-2`}>
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'relative p-3 rounded-xl border-2 text-left transition-all duration-200',
            value === opt.value
              ? 'border-violet-500 bg-violet-500/15 shadow shadow-violet-500/20'
              : 'border-white/10 bg-white/5 hover:border-white/20'
          )}
        >
          {opt.emoji && <div className="text-xl mb-1">{opt.emoji}</div>}
          <div className="text-xs font-semibold text-white">{opt.label}</div>
          {opt.sublabel && <div className="text-[10px] text-white/40 mt-0.5">{opt.sublabel}</div>}
          {opt.cost !== undefined && (
            <div className="text-[10px] text-amber-400 mt-0.5">
              +${opt.cost.toLocaleString()}/ronda
            </div>
          )}
          {value === opt.value && (
            <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-violet-500 rounded-full flex items-center justify-center">
              <span className="text-[9px] text-white font-bold">✓</span>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

interface MultiPickerProps {
  options: { value: string; label: string; emoji?: string }[];
  values: string[];
  onChange: (v: string[]) => void;
  max?: number;
}

export function MultiPicker({ options, values, onChange, max }: MultiPickerProps) {
  function toggle(v: string) {
    if (values.includes(v)) {
      onChange(values.filter(x => x !== v));
    } else if (!max || values.length < max) {
      onChange([...values, v]);
    }
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          onClick={() => toggle(opt.value)}
          className={cn(
            'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all',
            values.includes(opt.value)
              ? 'border-violet-500 bg-violet-500/20 text-violet-300'
              : 'border-white/10 bg-white/5 text-white/50 hover:border-white/20'
          )}
        >
          {opt.emoji} {opt.label}
        </button>
      ))}
    </div>
  );
}

interface SectionCardProps {
  title: string;
  emoji: string;
  children: React.ReactNode;
  badge?: string;
  defaultOpen?: boolean;
}

export function SectionCard({ title, emoji, children, badge, defaultOpen = true }: SectionCardProps) {
  return (
    <details open={defaultOpen} className="glass-card rounded-2xl overflow-hidden group">
      <summary className="flex items-center gap-3 p-4 cursor-pointer list-none hover:bg-white/5 transition-colors">
        <span className="text-2xl">{emoji}</span>
        <span className="font-bold text-white flex-1">{title}</span>
        {badge && <span className="text-xs bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full">{badge}</span>}
        <span className="text-white/40 text-sm group-open:rotate-180 transition-transform">▼</span>
      </summary>
      <div className="px-4 pb-5 flex flex-col gap-4 border-t border-white/5 pt-4">
        {children}
      </div>
    </details>
  );
}
