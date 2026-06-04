import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { adminDb } from '@/lib/firebase/admin';
import { simulateRound } from '@/lib/simulation/engine';
import { pickRandomEvents } from '@/constants/events';
import type { Decision, Company, Game, Round } from '@/types';

// Vercel Cron Job: runs every hour at :00
// In vercel.json: { "crons": [{ "path": "/api/cron", "schedule": "0 * * * *" }] }

export async function GET(req: NextRequest) {
  // In production Vercel sends Authorization: Bearer <CRON_SECRET> automatically.
  // In local dev (no CRON_SECRET set) we allow all requests for testing.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const db = adminDb();
  const now = new Date();
  const currentHour = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Find active games whose close time matches current hour (within ±5 min window)
  const gamesSnap = await db.collection('games')
    .where('status', '==', 'active')
    .get();

  const results: string[] = [];

  for (const gameDoc of gamesSnap.docs) {
    const game = { id: gameDoc.id, ...gameDoc.data() } as Game;

    // Check if close time matches current time (±5 min tolerance)
    if (!isCloseTimeNow(game.decisionCloseTime, now)) continue;

    try {
      await runGameSimulation(db, game);
      results.push(`✓ Game ${game.id} simulated`);
    } catch (err) {
      results.push(`✗ Game ${game.id}: ${String(err)}`);
    }
  }

  return NextResponse.json({ processed: results, time: currentHour });
}

function isCloseTimeNow(closeTime: string, now: Date): boolean {
  const [h, m] = closeTime.split(':').map(Number);
  const closeMinutes = h * 60 + m;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return Math.abs(closeMinutes - nowMinutes) <= 5;
}

async function runGameSimulation(db: FirebaseFirestore.Firestore, game: Game) {
  const roundNumber = game.currentRound;

  // Pick 1-2 random events for this round
  const events = pickRandomEvents(Math.random() > 0.6 ? 2 : 1);
  const primaryEvent = events[0];

  // Get all open rounds for this game/round
  const roundsSnap = await db.collection('rounds')
    .where('gameId', '==', game.id)
    .where('roundNumber', '==', roundNumber)
    .where('status', 'in', ['open', 'locked'])
    .get();

  const batch = db.batch();
  const companyUpdates: Array<{ id: string; capital: number; profitability: number }> = [];

  for (const roundDoc of roundsSnap.docs) {
    const round = { id: roundDoc.id, ...roundDoc.data() } as Round;

    // Get company
    const companySnap = await db.collection('companies').doc(round.companyId).get();
    if (!companySnap.exists) continue;
    const company = { id: companySnap.id, ...companySnap.data() } as Company;

    // If no decision was submitted, use previous round's decision with penalty flag
    let decision = round.decision;
    if (!decision) {
      const prevRound = await db.collection('rounds')
        .where('companyId', '==', round.companyId)
        .where('roundNumber', '==', roundNumber - 1)
        .where('status', '==', 'done')
        .limit(1)
        .get();

      if (!prevRound.empty) {
        decision = prevRound.docs[0].data().decision as Decision;
        // Apply inactivity penalty: reduce units by 10% to simulate autopilot
        if (decision) {
          decision = { ...decision, unitsProduced: Math.floor(decision.unitsProduced * 0.9) };
        }
      }
    }

    if (!decision) continue;

    // Run simulation
    const partialResult = simulateRound(decision, company, game, primaryEvent);
    const result = { ...partialResult, rankInGame: 0, totalParticipants: 0 };

    // Update round
    batch.update(roundDoc.ref, {
      status: 'done',
      simulatedAt: new Date(),
      decision,
      result,
      eventId: primaryEvent?.id ?? null,
    });

    // Update company
    batch.update(db.collection('companies').doc(company.id), {
      currentCapital: result.endingCapital,
      netWorth: result.endingCapital, // simplified; add company value logic later
      brandStrength: result.brandStrengthNew,
      customerSatisfaction: result.customerSatisfactionNew,
      employeeMorale: result.employeeMoraleNew,
      roundsCompleted: roundNumber,
    });

    companyUpdates.push({
      id: round.uid,
      capital: result.endingCapital,
      profitability: result.cumulativeProfitability,
    });
  }

  // Rank all companies
  companyUpdates.sort((a, b) => b.profitability - a.profitability);
  const total = companyUpdates.length;
  companyUpdates.forEach((c, idx) => {
    batch.update(
      db.collection('leaderboard').doc(game.id).collection('entries').doc(c.id),
      {
        currentCapital: c.capital,
        cumulativeProfitability: c.profitability,
        rank: idx + 1,
        totalParticipants: total,
        lastUpdated: new Date(),
      }
    );
  });

  // Advance game round
  const nextRound = roundNumber + 1;
  const openAt = new Date();
  openAt.setDate(openAt.getDate() + 1);
  openAt.setHours(6, 0, 0, 0);

  const closeAt = new Date(openAt);
  const [ch, cm] = game.decisionCloseTime.split(':').map(Number);
  closeAt.setHours(ch, cm, 0, 0);

  batch.update(db.collection('games').doc(game.id), {
    currentRound: nextRound <= game.totalRounds ? nextRound : game.totalRounds,
    status: nextRound > game.totalRounds ? 'completed' : 'active',
  });

  // Create next round documents for each participant
  if (nextRound <= game.totalRounds) {
    for (const update of companyUpdates) {
      const companySnap = await db.collection('companies')
        .where('uid', '==', update.id)
        .where('gameId', '==', game.id)
        .limit(1)
        .get();
      if (companySnap.empty) continue;
      const company = companySnap.docs[0];

      const newRoundRef = db.collection('rounds').doc();
      batch.set(newRoundRef, {
        gameId: game.id,
        companyId: company.id,
        uid: update.id,
        roundNumber: nextRound,
        status: 'open',
        openAt,
        closeAt,
        startingCapital: update.capital,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  await batch.commit();
}
