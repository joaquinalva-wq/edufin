'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { doc, setDoc, updateDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuthStore } from '@/store/authStore';
import { PRODUCT_LIST, LOCATION_LIST, INITIAL_CAPITAL } from '@/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { ProductId, LocationId } from '@/types';

const LOGO_COLORS = [
  '#7c3aed', '#ec4899', '#06b6d4', '#10b981',
  '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6',
];

const STEPS = ['names', 'product', 'location', 'color', 'confirm'] as const;

export default function CreateCompanyPage({ params }: { params: { locale: string } }) {
  const t = useTranslations('company');
  const tc = useTranslations('common');
  const tP = useTranslations('products');
  const tL = useTranslations('locations');
  const router = useRouter();
  const { user } = useAuthStore();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Guard: must belong to a game first
  useEffect(() => {
    if (user && !user.activeGameId) {
      router.replace(`/${params.locale}/game/setup`);
    }
  }, [user, params.locale, router]);

  const [companyName, setCompanyName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [productId, setProductId] = useState<ProductId | null>(null);
  const [locationId, setLocationId] = useState<LocationId | null>(null);
  const [logoColor, setLogoColor] = useState(LOGO_COLORS[0]);

  const currentStep = STEPS[step];

  function canAdvance() {
    if (currentStep === 'names') return companyName.trim().length >= 2 && brandName.trim().length >= 2;
    if (currentStep === 'product') return productId !== null;
    if (currentStep === 'location') return locationId !== null;
    if (currentStep === 'color') return true;
    return true;
  }

  async function handleCreate() {
    if (!user || !productId || !locationId) return;
    setLoading(true);
    try {
      const companyRef = doc(collection(db, 'companies'));
      await setDoc(companyRef, {
        id: companyRef.id,
        uid: user.uid,
        gameId: user.activeGameId ?? '',
        name: companyName.trim(),
        brandName: brandName.trim(),
        productId,
        locationId,
        logoColor,
        initialCapital: INITIAL_CAPITAL,
        currentCapital: INITIAL_CAPITAL,
        netWorth: INITIAL_CAPITAL,
        brandStrength: 0,
        customerSatisfaction: 0.5,
        employeeMorale: 0.5,
        localLevel: 0,
        roundsCompleted: 0,
        createdAt: new Date(),
      });

      await updateDoc(doc(db, 'users', user.uid), {
        activeCompanyId: companyRef.id,
      });

      router.push(`/${params.locale}/dashboard`);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 animate-slide-up">
          <h1 className="text-3xl font-bold gradient-text">{t('create_title')}</h1>
          <p className="text-white/50 mt-2">{t('create_subtitle')}</p>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i <= step ? 'bg-violet-500' : 'bg-white/10'}`} />
          ))}
        </div>

        {/* Step content */}
        <div className="glass-card rounded-3xl p-8 animate-fade-in">

          {/* STEP 1: Names */}
          {currentStep === 'names' && (
            <div className="flex flex-col gap-5">
              <div className="text-center mb-4">
                <div className="text-4xl mb-2">✍️</div>
                <h2 className="text-xl font-bold text-white">Dale un nombre a tu empresa</h2>
              </div>
              <Input label={t('company_name')} value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Ej: Tech Riders SA" />
              <Input label={t('brand_name')} value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="Ej: TechRide" />
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-amber-300 text-xs">
                {t('irrevocable_warning')}
              </div>
            </div>
          )}

          {/* STEP 2: Product */}
          {currentStep === 'product' && (
            <div>
              <div className="text-center mb-6">
                <div className="text-4xl mb-2">📦</div>
                <h2 className="text-xl font-bold text-white">{t('choose_product')}</h2>
                <p className="text-white/50 text-sm mt-1">{t('product_hint')}</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {PRODUCT_LIST.map(product => (
                  <button
                    key={product.id}
                    onClick={() => setProductId(product.id)}
                    className={`relative p-4 rounded-2xl border-2 transition-all duration-200 text-left ${
                      productId === product.id
                        ? 'border-violet-500 bg-violet-500/15 shadow-lg shadow-violet-500/20'
                        : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8'
                    }`}
                  >
                    <div className="text-3xl mb-2">{product.emoji}</div>
                    <div className="text-sm font-semibold text-white leading-tight">
                      {tP(`${product.id}.name`)}
                    </div>
                    <div className="text-xs text-white/40 mt-1">
                      Costo: ${product.unitCost.toLocaleString()}
                    </div>
                    <div className="text-xs text-white/40">
                      Precio: ${product.minPrice.toLocaleString()}–${product.maxPrice.toLocaleString()}
                    </div>
                    {productId === product.id && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-violet-500 rounded-full flex items-center justify-center text-white text-xs">✓</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: Location */}
          {currentStep === 'location' && (
            <div>
              <div className="text-center mb-6">
                <div className="text-4xl mb-2">📍</div>
                <h2 className="text-xl font-bold text-white">{t('choose_location')}</h2>
                <p className="text-white/50 text-sm mt-1">{t('location_hint')}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {LOCATION_LIST.map(location => (
                  <button
                    key={location.id}
                    onClick={() => setLocationId(location.id)}
                    className={`relative p-4 rounded-2xl border-2 transition-all duration-200 text-left ${
                      locationId === location.id
                        ? 'border-violet-500 bg-violet-500/15 shadow-lg shadow-violet-500/20'
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                    }`}
                  >
                    <div className="text-2xl mb-1.5">{location.emoji}</div>
                    <div className="text-sm font-semibold text-white">
                      {tL(`${location.id}.name`)}
                    </div>
                    <div className="text-xs text-white/40 mt-1">
                      Alquiler: ${location.rentPerRound.toLocaleString()}/ronda
                    </div>
                    <div className="flex gap-1 mt-2">
                      <span className="text-xs bg-white/10 rounded-md px-1.5 py-0.5 text-white/50">
                        Tráfico {Math.round(location.trafficMultiplier * 100)}%
                      </span>
                    </div>
                    {locationId === location.id && (
                      <div className="absolute top-2 right-2 w-5 h-5 bg-violet-500 rounded-full flex items-center justify-center text-white text-xs">✓</div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: Color */}
          {currentStep === 'color' && (
            <div>
              <div className="text-center mb-8">
                <div className="text-4xl mb-2">🎨</div>
                <h2 className="text-xl font-bold text-white">{t('choose_color')}</h2>
              </div>

              {/* Preview */}
              <div className="flex items-center gap-4 glass rounded-2xl p-5 mb-6">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white shadow-lg flex-shrink-0"
                  style={{ backgroundColor: logoColor }}
                >
                  {brandName.charAt(0).toUpperCase() || 'E'}
                </div>
                <div>
                  <div className="font-bold text-white">{brandName || 'Tu Marca'}</div>
                  <div className="text-white/50 text-sm">{companyName || 'Tu Empresa'}</div>
                </div>
              </div>

              {/* Color picker */}
              <div className="flex flex-wrap gap-3 justify-center">
                {LOGO_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setLogoColor(color)}
                    className={`w-12 h-12 rounded-xl transition-all duration-200 ${logoColor === color ? 'scale-110 ring-2 ring-white ring-offset-2 ring-offset-transparent' : 'hover:scale-105'}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* STEP 5: Confirm */}
          {currentStep === 'confirm' && (
            <div>
              <div className="text-center mb-6">
                <div className="text-4xl mb-2">🚀</div>
                <h2 className="text-xl font-bold text-white">{t('confirm_title')}</h2>
                <p className="text-amber-300 text-sm mt-1">{t('confirm_warning')}</p>
              </div>

              <div className="flex flex-col gap-3">
                {[
                  { label: 'Empresa', value: companyName },
                  { label: 'Marca', value: brandName },
                  { label: 'Producto', value: `${PRODUCT_LIST.find(p => p.id === productId)?.emoji} ${productId}` },
                  { label: 'Ubicación', value: `${LOCATION_LIST.find(l => l.id === locationId)?.emoji} ${locationId}` },
                  { label: 'Capital inicial', value: '$100,000 USD' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-white/50 text-sm">{label}</span>
                    <span className="text-white font-medium">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex gap-3 mt-6">
          {step > 0 && (
            <Button variant="secondary" size="lg" onClick={() => setStep(s => s - 1)} className="flex-1">
              ← {tc('back')}
            </Button>
          )}

          {currentStep !== 'confirm' ? (
            <Button
              variant="gradient"
              size="lg"
              className="flex-1"
              disabled={!canAdvance()}
              onClick={() => setStep(s => s + 1)}
            >
              {tc('next')} →
            </Button>
          ) : (
            <Button variant="gradient" size="lg" className="flex-1" loading={loading} onClick={handleCreate}>
              🚀 ¡Crear mi empresa!
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
