'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

const STEPS = [
  { key: 'step1', icon: '🏢', color: 'from-violet-500 to-purple-600' },
  { key: 'step2', icon: '⚖️', color: 'from-pink-500 to-rose-600' },
  { key: 'step3', icon: '📈', color: 'from-emerald-500 to-teal-600' },
  { key: 'step4', icon: '🏆', color: 'from-amber-500 to-orange-600' },
];

export default function OnboardingPage({ params }: { params: { locale: string } }) {
  const t = useTranslations('onboarding');
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [animating, setAnimating] = useState(false);

  function goNext() {
    if (step < STEPS.length - 1) {
      setAnimating(true);
      setTimeout(() => { setStep(s => s + 1); setAnimating(false); }, 200);
    } else {
      router.push(`/${params.locale}/company/create`);
    }
  }

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-violet-600/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl" />
      </div>

      <div className={`relative z-10 w-full max-w-md transition-opacity duration-200 ${animating ? 'opacity-0' : 'opacity-100'}`}>
        {/* Step dots */}
        <div className="flex justify-center gap-2 mb-10">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-2 rounded-full transition-all duration-300 ${i === step ? 'w-8 bg-violet-400' : 'w-2 bg-white/20'}`}
            />
          ))}
        </div>

        {/* Card */}
        <div className="glass-card rounded-3xl p-10 text-center animate-fade-in">
          <div className={`w-24 h-24 rounded-3xl bg-gradient-to-br ${current.color} flex items-center justify-center text-5xl mx-auto mb-6 shadow-lg animate-bounce-subtle`}>
            {current.icon}
          </div>

          <h2 className="text-2xl font-bold text-white mb-3">
            {t(`${current.key}_title`)}
          </h2>
          <p className="text-white/60 leading-relaxed">
            {t(`${current.key}_desc`)}
          </p>

          <Button
            variant="gradient"
            size="xl"
            className="w-full mt-8"
            onClick={goNext}
          >
            {isLast ? t('start') : '→ Siguiente'}
          </Button>
        </div>

        {/* Skip */}
        {!isLast && (
          <button
            onClick={() => router.push(`/${params.locale}/company/create`)}
            className="block text-center text-sm text-white/30 hover:text-white/60 mt-4 w-full transition-colors"
          >
            Saltar tutorial
          </button>
        )}
      </div>
    </div>
  );
}
