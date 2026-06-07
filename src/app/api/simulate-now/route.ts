import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { runGameSimulation } from '@/lib/simulation/runGame';
import type { Game } from '@/types';

// POST /api/simulate-now
// Body: { gameId: string }
// Auth: Bearer <firebase-id-token>
// Caller must be the game's adminUid OR a system admin (role === 'admin').

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized — missing token' }, { status: 401 });
    }

    let decoded;
    try {
      decoded = await adminAuth().verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: 'Unauthorized — invalid token' }, { status: 401 });
    }

    const body = await req.json();
    const { gameId } = body as { gameId?: string };
    if (!gameId) {
      return NextResponse.json({ error: 'Missing gameId' }, { status: 400 });
    }

    const db = adminDb();
    const gameDoc = await db.collection('games').doc(gameId).get();
    if (!gameDoc.exists) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 });
    }
    const game = { id: gameDoc.id, ...gameDoc.data() } as Game;

    if (game.status !== 'active') {
      return NextResponse.json({ error: `Game is not active (status: ${game.status})` }, { status: 400 });
    }

    // Authorization: game creator OR system admin
    const userDoc = await db.collection('users').doc(decoded.uid).get();
    const userData = userDoc.data();
    const isSystemAdmin = userData?.role === 'admin';
    const isGameHost = game.adminUid === decoded.uid;
    if (!isSystemAdmin && !isGameHost) {
      return NextResponse.json({ error: 'Forbidden — not game host or admin' }, { status: 403 });
    }

    const msg = await runGameSimulation(db, game);
    return NextResponse.json({ success: true, message: msg, round: game.currentRound });
  } catch (err) {
    console.error('[simulate-now]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
