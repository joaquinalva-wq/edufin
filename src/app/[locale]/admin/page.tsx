'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, query, orderBy, addDoc, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { db } from '@/lib/firebase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency, formatPercent, generateJoinCode } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { computeStudentAnalytics } from '@/lib/simulation/analytics';
import { INITIAL_CAPITAL, DEFAULT_CLOSE_TIME, DEFAULT_TIMEZONE } from '@/constants';
import type { Game, Company, User, Round } from '@/types';
import Papa from 'papaparse';
import jsPDF from 'jspdf';

type Tab = 'games' | 'students' | 'reports';

export default function AdminPage({ params }: { params: { locale: string } }) {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();
  const locale = params.locale;

  const [tab, setTab] = useState<Tab>('games');
  const [games, setGames] = useState<Game[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<{ user: User; company: Company; rounds: Round[] } | null>(null);
  const [showNewGame, setShowNewGame] = useState(false);
  const [newGame, setNewGame] = useState({ name: '', closeTime: DEFAULT_CLOSE_TIME, simulationMode: 'manual' as 'automatic' | 'manual' });
  const [filters, setFilters] = useState({ school: '', grade: '', subject: '' });
  const [dataLoading, setDataLoading] = useState(true);
  const [simulating, setSimulating] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      router.push(`/${locale}/login`);
    }
  }, [user, loading, isAdmin, locale, router]);

  useEffect(() => {
    if (!isAdmin) return;
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  async function loadAll() {
    setDataLoading(true);
    const [gSnap, cSnap, uSnap] = await Promise.all([
      getDocs(query(collection(db, 'games'), orderBy('createdAt', 'desc'))),
      getDocs(query(collection(db, 'companies'), orderBy('createdAt', 'desc'))),
      getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'))),
    ]);
    setGames(gSnap.docs.map(d => ({ id: d.id, ...d.data() } as Game)));
    setCompanies(cSnap.docs.map(d => ({ id: d.id, ...d.data() } as Company)));
    setUsers(uSnap.docs.map(d => ({ ...d.data(), uid: d.id } as unknown as User)).filter(u => u.role === 'student'));
    setDataLoading(false);
  }

  async function createGame() {
    const code = generateJoinCode();
    const now = new Date();

    await addDoc(collection(db, 'games'), {
      name: newGame.name,
      joinCode: code,
      adminUid: user!.uid,
      status: 'active',
      simulationMode: newGame.simulationMode,
      currentRound: 1,
      totalRounds: 10,
      initialCapital: INITIAL_CAPITAL,
      decisionCloseTime: newGame.closeTime,
      timezone: DEFAULT_TIMEZONE,
      participantCount: 0,
      roundHistory: [],
      createdAt: now,
    });
    setShowNewGame(false);
    setNewGame({ name: '', closeTime: DEFAULT_CLOSE_TIME, simulationMode: 'manual' });
    await loadAll();
  }

  async function startGame(gameId: string) {
    await updateDoc(doc(db, 'games', gameId), { status: 'active', startedAt: new Date() });
    await loadAll();
  }

  async function pauseGame(gameId: string, current: string) {
    await updateDoc(doc(db, 'games', gameId), { status: current === 'active' ? 'paused' : 'active' });
    await loadAll();
  }

  async function toggleSimMode(gameId: string, current: string) {
    const next = current === 'automatic' ? 'manual' : 'automatic';
    await updateDoc(doc(db, 'games', gameId), { simulationMode: next });
    await loadAll();
  }

  async function deleteGame(gameId: string) {
    if (!confirm('¿Dar de baja este grupo? Esta acción no se puede deshacer.')) return;
    await deleteDoc(doc(db, 'games', gameId));
    await loadAll();
  }

  async function simulateGame(gameId: string) {
    const token = await getAuth().currentUser?.getIdToken();
    if (!token) return;
    setSimulating(gameId);
    try {
      const res = await fetch('/api/simulate-now', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ gameId }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`✅ Simulación completada: ${data.message}`);
        await loadAll();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert(`Error de red: ${String(err)}`);
    } finally {
      setSimulating(null);
    }
  }

  async function loadStudentDetail(u: User) {
    const comp = companies.find(c => c.uid === u.uid);
    if (!comp) return;
    const roundsSnap = await getDocs(
      query(collection(db, 'rounds'), orderBy('roundNumber', 'asc'))
    );
    const rounds = roundsSnap.docs
      .map(d => ({ id: d.id, ...d.data() } as Round))
      .filter(r => r.companyId === comp.id);
    setSelectedStudent({ user: u, company: comp, rounds });
  }

  function exportCSV() {
    const rows = filteredStudents.map(u => {
      const comp = companies.find(c => c.uid === u.uid);
      return {
        Nombre: u.displayName,
        Email: u.email,
        Colegio: u.school,
        Grado: u.grade,
        Materia: u.subject,
        Producto: comp?.productId ?? '-',
        Ubicacion: comp?.locationId ?? '-',
        CapitalInicial: INITIAL_CAPITAL,
        CapitalActual: comp?.currentCapital ?? '-',
        Rentabilidad: comp ? formatPercent(((comp.currentCapital - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100) : '-',
        RondasCompletadas: comp?.roundsCompleted ?? 0,
        MarcaFortaleza: comp ? Math.round(comp.brandStrength * 100) + '%' : '-',
        SatisfaccionCliente: comp ? Math.round(comp.customerSatisfaction * 100) + '%' : '-',
      };
    });
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `edufin-estudiantes-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  function exportStudentPDF(u: User, comp: Company, rounds: Round[]) {
    const pdf = new jsPDF();
    const analytics = computeStudentAnalytics(rounds, u.uid);

    pdf.setFontSize(20);
    pdf.setTextColor(124, 58, 237);
    pdf.text('EduFin — Reporte de Estudiante', 20, 20);

    pdf.setFontSize(12);
    pdf.setTextColor(0, 0, 0);
    pdf.text(`Nombre: ${u.displayName}`, 20, 35);
    pdf.text(`Colegio: ${u.school} | Grado: ${u.grade} | Materia: ${u.subject}`, 20, 43);
    pdf.text(`Empresa: ${comp.name} (${comp.brandName})`, 20, 51);
    pdf.text(`Producto: ${comp.productId} | Ubicación: ${comp.locationId}`, 20, 59);

    pdf.setFontSize(14);
    pdf.setTextColor(124, 58, 237);
    pdf.text('Resultados financieros', 20, 75);

    pdf.setFontSize(11);
    pdf.setTextColor(0, 0, 0);
    pdf.text(`Capital inicial: ${formatCurrency(INITIAL_CAPITAL)}`, 20, 85);
    pdf.text(`Capital actual: ${formatCurrency(comp.currentCapital)}`, 20, 93);
    pdf.text(`Rentabilidad acumulada: ${formatPercent(((comp.currentCapital - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100)}`, 20, 101);
    pdf.text(`Rondas completadas: ${comp.roundsCompleted} / 10`, 20, 109);

    pdf.setFontSize(14);
    pdf.setTextColor(124, 58, 237);
    pdf.text('Perfil estratégico', 20, 125);

    pdf.setFontSize(11);
    pdf.setTextColor(0, 0, 0);
    pdf.text(`Estrategia dominante: ${analytics.dominantStrategy}`, 20, 135);
    pdf.text(`Nivel de riesgo: ${Math.round(analytics.riskScore * 100)}%`, 20, 143);
    pdf.text(`Diversificación: ${Math.round(analytics.diversificationScore * 100)}%`, 20, 151);
    pdf.text(`Uso de investigación: ${Math.round(analytics.marketResearchUsage * 100)}%`, 20, 159);
    pdf.text(`Gestión de liquidez: ${Math.round(analytics.liquidityManagement * 100)}%`, 20, 167);

    pdf.setFontSize(14);
    pdf.setTextColor(124, 58, 237);
    pdf.text('Reporte automático', 20, 183);

    pdf.setFontSize(10);
    pdf.setTextColor(60, 60, 60);
    const lines = pdf.splitTextToSize(analytics.autoReportEs, 170);
    pdf.text(lines, 20, 193);

    pdf.save(`reporte-${u.displayName.replace(/\s+/g, '_')}.pdf`);
  }

  const filteredStudents = users.filter(u =>
    (!filters.school  || u.school.toLowerCase().includes(filters.school.toLowerCase())) &&
    (!filters.grade   || u.grade.toLowerCase().includes(filters.grade.toLowerCase()))   &&
    (!filters.subject || u.subject.toLowerCase().includes(filters.subject.toLowerCase()))
  );

  if (loading || dataLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-5xl animate-bounce-subtle">🔄</div>
    </div>
  );

  // Student detail modal
  if (selectedStudent) {
    const { user: su, company: sc, rounds: sr } = selectedStudent;
    const analytics = computeStudentAnalytics(sr, su.uid);
    const profitability = ((sc.currentCapital - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100;

    return (
      <div className="min-h-screen p-4 max-w-3xl mx-auto pb-12">
        <button onClick={() => setSelectedStudent(null)} className="text-violet-400 text-sm mb-4 hover:text-violet-300">
          ← Volver a estudiantes
        </button>

        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">{su.displayName}</h1>
            <p className="text-white/50 text-sm">{su.school} · {su.grade} · {su.subject}</p>
          </div>
          <Button variant="gradient" size="sm" onClick={() => exportStudentPDF(su, sc, sr)}>
            📄 Exportar PDF
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: 'Capital actual', val: formatCurrency(sc.currentCapital, true) },
            { label: 'Rentabilidad', val: formatPercent(profitability), colored: true, positive: profitability >= 0 },
            { label: 'Rondas completadas', val: `${sc.roundsCompleted}/10` },
          ].map(({ label, val, colored, positive }) => (
            <div key={label} className="glass-card rounded-xl p-3 text-center">
              <div className={`text-lg font-bold ${colored ? (positive ? 'text-emerald-400' : 'text-red-400') : 'text-white'}`}>{val}</div>
              <div className="text-xs text-white/40">{label}</div>
            </div>
          ))}
        </div>

        <div className="glass-card rounded-2xl p-4 mb-4">
          <h3 className="font-bold text-white mb-3">🧠 Perfil estratégico</h3>
          <p className="text-xs text-white/60 mb-3 leading-relaxed">{analytics.autoReportEs}</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Riesgo', val: analytics.riskScore },
              { label: 'Diversificación', val: analytics.diversificationScore },
              { label: 'Uso de research', val: analytics.marketResearchUsage },
              { label: 'Fit producto-ubi.', val: analytics.productLocationCoherence / 1.4 },
              { label: 'Gestión liquidez', val: analytics.liquidityManagement },
              { label: 'Adaptabilidad', val: analytics.adaptabilityScore },
            ].map(({ label, val }) => (
              <div key={label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-white/50">{label}</span>
                  <span className="text-white font-medium">{Math.round(val * 100)}%</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full">
                  <div className="h-full bg-violet-500 rounded-full" style={{ width: `${val * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-card rounded-2xl p-4">
          <h3 className="font-bold text-white mb-3">📊 Historial de rondas</h3>
          {sr.filter(r => r.result).map(r => (
            <div key={r.id} className="flex justify-between items-center py-2 border-b border-white/5">
              <div className="text-sm text-white/70">Ronda {r.roundNumber}</div>
              <div className="flex gap-4 text-xs">
                <span className="text-white/40">Vendidas: {r.result?.unitsSold}</span>
                <span className={`font-medium ${(r.result?.capitalChangePct ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatPercent(r.result?.capitalChangePct ?? 0)}
                </span>
                <span className="text-white/40">{formatCurrency(r.result?.endingCapital ?? 0, true)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pt-2">
        <div>
          <h1 className="text-2xl font-bold gradient-text">Panel Admin</h1>
          <p className="text-white/40 text-sm">{user?.email}</p>
        </div>
        <div className="flex gap-2">
          {tab === 'students' && (
            <Button variant="secondary" size="sm" onClick={exportCSV}>📊 CSV</Button>
          )}
          <Button variant="secondary" size="sm" onClick={loadAll}>🔄</Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 bg-white/5 rounded-xl p-1">
        {(['games', 'students', 'reports'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === t ? 'bg-violet-600 text-white shadow' : 'text-white/50 hover:text-white'}`}>
            {t === 'games' ? '🎮 Juegos' : t === 'students' ? '👥 Estudiantes' : '📋 Reportes'}
          </button>
        ))}
      </div>

      {/* GAMES TAB */}
      {tab === 'games' && (
        <div className="flex flex-col gap-4">
          <Button variant="gradient" onClick={() => setShowNewGame(true)}>+ Crear juego</Button>

          {showNewGame && (
            <div className="glass-card rounded-2xl p-5 border border-violet-500/20">
              <h3 className="font-bold text-white mb-4">➕ Nuevo grupo / juego</h3>
              <div className="flex flex-col gap-3">
                <Input label="Nombre del grupo" value={newGame.name} onChange={e => setNewGame(p => ({ ...p, name: e.target.value }))} placeholder="5to A — Economía 2026" />
                <Input label="Hora de cierre de decisiones (hh:mm)" type="time" value={newGame.closeTime} onChange={e => setNewGame(p => ({ ...p, closeTime: e.target.value }))} />
                <div>
                  <p className="text-sm text-white/60 mb-2">Modo de simulación</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'manual', emoji: '🎯', label: 'Manual', hint: 'Corrés la simulación cuando quieras' },
                      { value: 'automatic', emoji: '⏰', label: 'Automático', hint: 'Corre sola todos los días a las 19:00' },
                    ].map(opt => (
                      <button key={opt.value}
                        onClick={() => setNewGame(p => ({ ...p, simulationMode: opt.value as 'automatic' | 'manual' }))}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${newGame.simulationMode === opt.value ? 'border-violet-500 bg-violet-500/15' : 'border-white/10 bg-white/5'}`}>
                        <div className="text-lg mb-1">{opt.emoji}</div>
                        <div className="text-xs font-bold text-white">{opt.label}</div>
                        <div className="text-[10px] text-white/40">{opt.hint}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2 mt-1">
                  <Button variant="secondary" className="flex-1" onClick={() => setShowNewGame(false)}>Cancelar</Button>
                  <Button variant="gradient" className="flex-1" onClick={createGame} disabled={!newGame.name}>🚀 Crear</Button>
                </div>
              </div>
            </div>
          )}

          {games.length === 0 && !showNewGame && (
            <div className="glass-card rounded-2xl p-8 text-center">
              <div className="text-4xl mb-3">🎮</div>
              <p className="text-white/50">No hay grupos todavía. Los estudiantes también pueden crear sus propios grupos.</p>
            </div>
          )}

          {games.map(game => {
            const simMode = (game as { simulationMode?: string }).simulationMode ?? 'automatic';
            const isSimulating = simulating === game.id;
            return (
            <div key={game.id} className="glass-card rounded-2xl p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-white">{game.name}</h3>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                      simMode === 'manual' ? 'bg-violet-500/20 text-violet-300' : 'bg-blue-500/20 text-blue-300'
                    }`}>
                      {simMode === 'manual' ? '🎯 Manual' : '⏰ Auto'}
                    </span>
                  </div>
                  <p className="text-xs text-white/40 mt-1">
                    Código: <span className="font-mono text-violet-400 font-bold tracking-widest text-sm">{game.joinCode}</span>
                  </p>
                </div>
                <span className={`ml-2 flex-shrink-0 px-2 py-1 rounded-full text-xs font-medium ${
                  game.status === 'active' ? 'bg-emerald-500/20 text-emerald-300' :
                  game.status === 'completed' ? 'bg-white/10 text-white/50' :
                  game.status === 'paused' ? 'bg-amber-500/20 text-amber-300' :
                  'bg-blue-500/20 text-blue-300'
                }`}>{game.status}</span>
              </div>

              <div className="flex gap-4 text-xs text-white/40 mb-4">
                <span>Ronda {game.currentRound}/{game.totalRounds}</span>
                <span>Cierre: {game.decisionCloseTime}</span>
                <span>{game.participantCount ?? 0} participantes</span>
              </div>

              {/* Round progress */}
              <div className="flex gap-1 mb-4">
                {Array.from({ length: game.totalRounds }, (_, i) => (
                  <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${
                    i < game.currentRound - 1 ? 'bg-violet-500' :
                    i === game.currentRound - 1 ? 'bg-violet-400 animate-pulse' : 'bg-white/10'
                  }`} />
                ))}
              </div>

              <div className="flex gap-2 flex-wrap">
                {game.status === 'setup' && (
                  <Button variant="success" size="sm" onClick={() => startGame(game.id)}>▶ Iniciar</Button>
                )}
                {(game.status === 'active' || game.status === 'paused') && (
                  <Button variant="secondary" size="sm" onClick={() => pauseGame(game.id, game.status)}>
                    {game.status === 'active' ? '⏸ Pausar' : '▶ Reanudar'}
                  </Button>
                )}
                {game.status === 'active' && (
                  <Button
                    variant={simMode === 'manual' ? 'gradient' : 'secondary'}
                    size="sm"
                    loading={isSimulating}
                    onClick={() => simulateGame(game.id)}
                  >
                    {isSimulating ? 'Simulando...' : '⚡ Simular ahora'}
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => toggleSimMode(game.id, simMode)}
                  title={`Cambiar a modo ${simMode === 'manual' ? 'automático' : 'manual'}`}
                >
                  {simMode === 'manual' ? '⏰' : '🎯'}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => deleteGame(game.id)} className="ml-auto text-red-400 hover:text-red-300">
                  🗑️
                </Button>
              </div>
            </div>
          );
          })}
        </div>
      )}

      {/* STUDENTS TAB */}
      {tab === 'students' && (
        <div className="flex flex-col gap-4">
          {/* Filters */}
          <div className="grid grid-cols-3 gap-2">
            <Input placeholder="Colegio..." value={filters.school}  onChange={e => setFilters(p => ({ ...p, school: e.target.value }))} />
            <Input placeholder="Grado..."  value={filters.grade}   onChange={e => setFilters(p => ({ ...p, grade: e.target.value }))} />
            <Input placeholder="Materia..." value={filters.subject} onChange={e => setFilters(p => ({ ...p, subject: e.target.value }))} />
          </div>

          <p className="text-sm text-white/40">{filteredStudents.length} estudiantes</p>

          {filteredStudents.map(u => {
            const comp = companies.find(c => c.uid === u.uid);
            const profitability = comp ? ((comp.currentCapital - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100 : null;

            return (
              <button
                key={u.uid}
                onClick={() => loadStudentDetail(u)}
                className="glass-card rounded-2xl p-4 text-left hover:bg-violet-500/10 transition-colors w-full"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">{u.displayName}</p>
                    <p className="text-xs text-white/40">{u.school} · {u.grade} · {u.subject}</p>
                    {comp && <p className="text-xs text-white/40 mt-0.5">{comp.name} · {comp.productId} · {comp.locationId}</p>}
                  </div>
                  <div className="text-right">
                    {profitability !== null ? (
                      <>
                        <div className={`text-sm font-bold ${profitability >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                          {formatPercent(profitability)}
                        </div>
                        <div className="text-xs text-white/40">{formatCurrency(comp!.currentCapital, true)}</div>
                      </>
                    ) : (
                      <span className="text-xs text-white/30">Sin empresa</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* REPORTS TAB */}
      {tab === 'reports' && (
        <div className="flex flex-col gap-4">
          <div className="glass-card rounded-2xl p-5">
            <h3 className="font-bold text-white mb-3">📊 Resumen del juego</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Juegos activos', val: games.filter(g => g.status === 'active').length },
                { label: 'Total estudiantes', val: users.length },
                { label: 'Con empresa', val: companies.length },
                { label: 'Capital promedio', val: companies.length > 0 ? formatCurrency(companies.reduce((s, c) => s + c.currentCapital, 0) / companies.length, true) : '-' },
              ].map(({ label, val }) => (
                <div key={label} className="bg-white/5 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-white">{val}</div>
                  <div className="text-xs text-white/40">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-2xl p-5">
            <h3 className="font-bold text-white mb-3">🏆 Top 5 por rentabilidad</h3>
            {companies
              .sort((a, b) => b.currentCapital - a.currentCapital)
              .slice(0, 5)
              .map((comp, i) => {
                const u = users.find(u => u.uid === comp.uid);
                const prof = ((comp.currentCapital - INITIAL_CAPITAL) / INITIAL_CAPITAL) * 100;
                return (
                  <div key={comp.id} className="flex items-center justify-between py-2 border-b border-white/5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{['🥇','🥈','🥉','4️⃣','5️⃣'][i]}</span>
                      <div>
                        <div className="text-sm font-medium text-white">{comp.name}</div>
                        <div className="text-xs text-white/40">{u?.displayName}</div>
                      </div>
                    </div>
                    <div className={`text-sm font-bold ${prof >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatPercent(prof)}
                    </div>
                  </div>
                );
              })
            }
          </div>
        </div>
      )}
    </div>
  );
}
