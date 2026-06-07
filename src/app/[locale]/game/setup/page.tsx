'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  doc, setDoc, getDocs, updateDoc,
  collection, query, where, limit,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/authStore';
import { generateJoinCode } from '@/lib/utils';
import { INITIAL_CAPITAL, DEFAULT_CLOSE_TIME, DEFAULT_TIMEZONE } from '@/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { SimulationMode } from '@/types';

type Screen = 'choose' | 'create' | 'join';

export default function GameSetupPage({ params }: { params: { locale: string } }) {
  const { user, loading } = useAuth();
  const setUser = useAuthStore(s => s.setUser);
  const router = useRouter();
  const locale = params.locale;

  const [screen, setScreen] = useState<Screen>('choose');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Create state
  const [gameName, setGameName] = useState('');
  const [simMode, setSimMode] = useState<SimulationMode>('manual');

  // Join state
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    if (!loading && !user) router.push(`/${locale}/login`);
  }, [user, loading, locale, router]);

  // Already in a game → skip to company create
  useEffect(() => {
    if (!loading && user?.activeGameId) {
      router.replace(`/${locale}/company/create`);
    }
  }, [user, loading, locale, router]);

  async function handleCreate() {
    if (!user || !gameName.trim()) return;
    setBusy(true);
    setError('');
    try {
      const code = generateJoinCode();
      const gameRef = doc(collection(db, 'games'));
      await setDoc(gameRef, {
        id: gameRef.id,
        name: gameName.trim(),
        joinCode: code,
        adminUid: user.uid,
        status: 'active',
        simulationMode: simMode,
        currentRound: 1,
        totalRounds: 10,
        initialCapital: INITIAL_CAPITAL,
        decisionCloseTime: DEFAULT_CLOSE_TIME,
        timezone: DEFAULT_TIMEZONE,
        participantCount: 1,
        roundHistory: [],
        createdAt: new Date(),
      });

      await updateDoc(doc(db, 'users', user.uid), { activeGameId: gameRef.id });
      // Update local store so company/create sees the new gameId immediately
      setUser({ ...user, activeGameId: gameRef.id });
      router.push(`/${locale}/company/create`);
    } catch (err) {
      setError('Error al crear el grupo. Intentá de nuevo.');
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (!user || joinCode.trim().length < 6) return;
    setBusy(true);
    setError('');
    try {
      const gamesQ = query(
        collection(db, 'games'),
        where('joinCode', '==', joinCode.trim().toUpperCase()),
        limit(1)
      );
      const snap = await getDocs(gamesQ);
      if (snap.empty) {
        setError('Código no encontrado. Verificá el código con quien creó el grupo.');
        setBusy(false);
        return;
      }
      const gameId = snap.docs[0].id;
      await updateDoc(doc(db, 'users', user.uid), { activeGameId: gameId });
      setUser({ ...user, activeGameId: gameId });
      router.push(`/${locale}/company/create`);
    } catch (err) {
      setError('Error al unirte. Intentá de nuevo.');
      console.error(err);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-5xl animate-bounce-subtle">⏳</div>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[30rem] h-[30rem] bg-violet-600/15 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-[30rem] h-[30rem] bg-pink-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">

        {/* ── CHOOSE ── */}
        {screen === 'choose' && (
          <div className="animate-fade-in">
            <div className="text-center mb-8">
              <div className="text-6xl mb-4 animate-bounce-subtle">🎮</div>
              <h1 className="text-3xl font-black gradient-text mb-2">¿Cómo querés jugar?</h1>
              <p className="text-white/50 text-sm">
                Cada grupo tiene su propio ranking, código de acceso y ritmo de simulación
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => setScreen('create')}
                className="glass-card rounded-2xl p-6 text-left border border-violet-500/30 hover:border-violet-500/60 hover:bg-violet-500/10 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-2xl shadow-lg group-hover:scale-110 transition-transform">
                    🏗️
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-white text-lg">Crear un grupo</div>
                    <div className="text-sm text-white/50 mt-0.5">
                      Vos creás el grupo y compartís el código con tus compañeros
                    </div>
                  </div>
                  <span className="text-white/30 text-2xl group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </button>

              <button
                onClick={() => setScreen('join')}
                className="glass-card rounded-2xl p-6 text-left border border-white/10 hover:border-emerald-500/40 hover:bg-emerald-500/5 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-2xl shadow-lg group-hover:scale-110 transition-transform">
                    🔑
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-white text-lg">Unirme a un grupo</div>
                    <div className="text-sm text-white/50 mt-0.5">
                      Tu profe o compañero ya creó el grupo y te comparte el código
                    </div>
                  </div>
                  <span className="text-white/30 text-2xl group-hover:translate-x-1 transition-transform">→</span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* ── CREATE ── */}
        {screen === 'create' && (
          <div className="animate-fade-in">
            <button onClick={() => setScreen('choose')} className="text-violet-400 text-sm mb-6 hover:text-violet-300 flex items-center gap-1">
              ← Volver
            </button>

            <div className="text-center mb-6">
              <div className="text-5xl mb-3">🏗️</div>
              <h2 className="text-2xl font-black text-white">Crear un grupo</h2>
              <p className="text-white/40 text-sm mt-1">Vas a recibir un código para compartir</p>
            </div>

            <div className="glass-card rounded-2xl p-6 flex flex-col gap-5">
              <Input
                label="Nombre del grupo"
                value={gameName}
                onChange={e => setGameName(e.target.value)}
                placeholder="Ej: 5to A — Economía 2026"
              />

              <div>
                <p className="text-sm font-semibold text-white/80 mb-3">Modo de simulación</p>
                <div className="flex flex-col gap-2">
                  {[
                    {
                      value: 'manual' as SimulationMode,
                      emoji: '🎯',
                      title: 'Manual (recomendado para clase)',
                      desc: 'Vos o el profe corren la simulación cuando quieran. Ideal para usar durante la clase, cada equipo ve sus resultados en vivo.',
                      badge: 'Recomendado',
                    },
                    {
                      value: 'automatic' as SimulationMode,
                      emoji: '⏰',
                      title: 'Automático (1 día = 1 mes)',
                      desc: 'La simulación corre sola todos los días a las 19:00 hs. Ideal para jugar durante semanas, como tarea entre clases.',
                      badge: null,
                    },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setSimMode(opt.value)}
                      className={`p-4 rounded-xl border-2 text-left transition-all ${
                        simMode === opt.value
                          ? 'border-violet-500 bg-violet-500/15 shadow-lg shadow-violet-500/10'
                          : 'border-white/10 bg-white/5 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{opt.emoji}</span>
                        <span className="text-sm font-bold text-white">{opt.title}</span>
                        {opt.badge && (
                          <span className="ml-auto text-[10px] bg-violet-500/30 text-violet-300 px-2 py-0.5 rounded-full">
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-white/45 leading-relaxed">{opt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <Button
                variant="gradient"
                size="lg"
                className="w-full"
                disabled={!gameName.trim()}
                loading={busy}
                onClick={handleCreate}
              >
                🚀 Crear grupo y continuar
              </Button>
            </div>
          </div>
        )}

        {/* ── JOIN ── */}
        {screen === 'join' && (
          <div className="animate-fade-in">
            <button onClick={() => setScreen('choose')} className="text-violet-400 text-sm mb-6 hover:text-violet-300 flex items-center gap-1">
              ← Volver
            </button>

            <div className="text-center mb-6">
              <div className="text-5xl mb-3">🔑</div>
              <h2 className="text-2xl font-black text-white">Unirme a un grupo</h2>
              <p className="text-white/40 text-sm mt-1">Pedile el código a quien creó el grupo</p>
            </div>

            <div className="glass-card rounded-2xl p-6 flex flex-col gap-5">
              <div>
                <label className="block text-sm font-semibold text-white/80 mb-2">Código del grupo</label>
                <input
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="ABC123"
                  maxLength={6}
                  className="w-full text-center text-3xl font-black tracking-[0.5em] bg-white/8 border border-white/15 rounded-xl py-4 text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/40 transition-all"
                />
                <p className="text-xs text-white/30 text-center mt-2">6 caracteres — mayúsculas y números</p>
              </div>

              {error && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <Button
                variant="gradient"
                size="lg"
                className="w-full"
                disabled={joinCode.length < 6}
                loading={busy}
                onClick={handleJoin}
              >
                🔑 Unirme al grupo
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
