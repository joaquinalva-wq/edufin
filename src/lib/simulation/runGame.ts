// Server-only: uses Firebase Admin SDK. Do NOT import in client components.
import { simulateRound } from './engine';
import { pickRandomEvents } from '@/constants/events';
import type { Decision, Company, Game, Round } from '@/types';

type DB = FirebaseFirestore.Firestore;

export async function runGameSimulation(db: DB, game: Game): Promise<string> {
  const roundNumber = game.currentRound;

  // Pick 1–2 random events for this round
  const events = pickRandomEvents(Math.random() > 0.6 ? 2 : 1);
  const primaryEvent = events[0];

  // Get all open/locked rounds for this game/round number
  const roundsSnap = await db.collection('rounds')
    .where('gameId', '==', game.id)
    .where('roundNumber', '==', roundNumber)
    .where('status', 'in', ['open', 'locked'])
    .get();

  if (roundsSnap.empty) {
    return `No open rounds found for game ${game.id} round ${roundNumber}`;
  }

  const batch = db.batch();
  const companyUpdates: Array<{ id: string; uid: string; capital: number; profitability: number }> = [];

  for (const roundDoc of roundsSnap.docs) {
    const round = { id: roundDoc.id, ...roundDoc.data() } as Round;

    const companySnap = await db.collection('companies').doc(round.companyId).get();
    if (!companySnap.exists) continue;
    const company = { id: companySnap.id, ...companySnap.data() } as Company;

    // If no decision submitted, reuse previous round's decision with an inactivity penalty
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
        if (decision) {
          decision = { ...decision, unitsProduced: Math.floor(decision.unitsProduced * 0.9) };
        }
      }
    }
    if (!decision) continue;

    const partialResult = simulateRound(decision, company, game, primaryEvent);
    const result = { ...partialResult, rankInGame: 0, totalParticipants: 0 };

    batch.update(roundDoc.ref, {
      status: 'done',
      simulatedAt: new Date(),
      decision,
      result,
      eventId: primaryEvent?.id ?? null,
    });

    batch.update(db.collection('companies').doc(company.id), {
      currentCapital: result.endingCapital,
      netWorth: result.endingCapital,
      brandStrength: result.brandStrengthNew,
      customerSatisfaction: result.customerSatisfactionNew,
      employeeMorale: result.employeeMoraleNew,
      roundsCompleted: roundNumber,
    });

    companyUpdates.push({
      id: round.companyId,
      uid: round.uid,
      capital: result.endingCapital,
      profitability: result.cumulativeProfitability,
    });
  }

  // Rank all companies by cumulative profitability
  companyUpdates.sort((a, b) => b.profitability - a.profitability);
  const total = companyUpdates.length;
  companyUpdates.forEach((c, idx) => {
    batch.update(
      db.collection('leaderboard').doc(game.id).collection('entries').doc(c.uid),
      {
        currentCapital: c.capital,
        cumulativeProfitability: c.profitability,
        rank: idx + 1,
        totalParticipants: total,
        lastUpdated: new Date(),
      }
    );
  });

  // Advance game round counter
  const nextRound = roundNumber + 1;
  batch.update(db.collection('games').doc(game.id), {
    currentRound: nextRound <= game.totalRounds ? nextRound : game.totalRounds,
    status: nextRound > game.totalRounds ? 'completed' : 'active',
  });

  // Create next round documents
  if (nextRound <= game.totalRounds) {
    const openAt = new Date();
    openAt.setDate(openAt.getDate() + 1);
    openAt.setHours(6, 0, 0, 0);
    const closeAt = new Date(openAt);
    const [ch, cm] = (game.decisionCloseTime ?? '22:00').split(':').map(Number);
    closeAt.setHours(ch, cm, 0, 0);

    for (const update of companyUpdates) {
      const companySnap = await db.collection('companies')
        .where('uid', '==', update.uid)
        .where('gameId', '==', game.id)
        .limit(1)
        .get();
      if (companySnap.empty) continue;
      const companyDoc = companySnap.docs[0];

      const newRoundRef = db.collection('rounds').doc();
      batch.set(newRoundRef, {
        gameId: game.id,
        companyId: companyDoc.id,
        uid: update.uid,
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
  return `Round ${roundNumber} simulated for ${companyUpdates.length} companies`;
}
