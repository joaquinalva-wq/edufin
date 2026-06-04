import { cn } from '@/lib/utils';
import type { FeedbackPoint } from '@/types';

const STYLES = {
  success: { bg: 'bg-emerald-500/10 border-emerald-500/30', icon: '✅', text: 'text-emerald-300' },
  warning: { bg: 'bg-amber-500/10 border-amber-500/30',     icon: '⚠️', text: 'text-amber-300'   },
  error:   { bg: 'bg-red-500/10 border-red-500/30',         icon: '❌', text: 'text-red-300'     },
  info:    { bg: 'bg-blue-500/10 border-blue-500/30',        icon: 'ℹ️', text: 'text-blue-300'    },
  tip:     { bg: 'bg-violet-500/10 border-violet-500/30',   icon: '💡', text: 'text-violet-300'  },
};

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}

interface Props {
  point: FeedbackPoint;
  messageMap: Record<string, string>;
}

export function FeedbackCard({ point, messageMap }: Props) {
  const s = STYLES[point.type];
  const title = interpolate(messageMap[point.titleKey] ?? point.titleKey, point.params);
  const message = interpolate(messageMap[point.messageKey] ?? point.messageKey, point.params);
  const learn = point.learnMoreKey ? messageMap[point.learnMoreKey] : undefined;

  return (
    <div className={cn('rounded-xl border p-4 animate-fade-in', s.bg)}>
      <div className="flex items-start gap-3">
        <span className="text-xl flex-shrink-0">{s.icon}</span>
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-bold mb-0.5', s.text)}>{title}</p>
          <p className="text-xs text-white/70 leading-relaxed">{message}</p>
          {learn && (
            <details className="mt-2">
              <summary className="text-xs text-white/40 cursor-pointer hover:text-white/60">¿Por qué? →</summary>
              <p className="text-xs text-white/50 mt-1 leading-relaxed">{learn}</p>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
