import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { adminDb } from '@/lib/firebase/admin';
import { runGameSimulation } from '@/lib/simulation/runGame';
import type { Game } from '@/types';

// Vercel Cron Job: runs once daily at 22:00 UTC (19:00 hs Argentina)
// In vercel.json: { "crons": [{ "path": "/api/cron", "schedule": "0 22 * * *" }] }
// Only processes games with simulationMode === 'automatic' (or undefined, for backwards compat).

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const db = adminDb();
  const now = new Date();

  const gamesSnap = await db.collection('games')
    .where('status', '==', 'active')
    .get();

  const results: string[] = [];

  for (const gameDoc of gamesSnap.docs) {
    const game = { id: gameDoc.id, ...gameDoc.data() } as Game;

    // Skip manual mode games — they are triggered by the host/admin via /api/simulate-now
    if (game.simulationMode === 'manual') {
      results.push(`⏭ Game ${game.id} (${game.name}) skipped — manual mode`);
      continue;
    }

    try {
      const msg = await runGameSimulation(db, game);
      results.push(`✓ ${msg}`);
    } catch (err) {
      results.push(`✗ Game ${game.id}: ${String(err)}`);
    }
  }

  return NextResponse.json({ processed: results, time: now.toISOString() });
}
