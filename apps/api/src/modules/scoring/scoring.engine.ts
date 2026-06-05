import { FixturePlayerStats, Position } from '@wcf/shared';

export interface ScoreResult {
  points: number; // final ×10 integer
  breakdown: Record<string, number>; // individual contributions + subtotal; stored as Json
}

// Pure function — testable in isolation. All values are ×10 integers.
export function ratingBonus(rating: number | null): number {
  if (rating === null || rating < 8) return 0;
  if (rating >= 10) return 20;
  if (rating >= 9) return 15;
  return 10; // 8.0 – 8.9
}

// Pure function — testable in isolation.
export function scorePlayer(
  position: Position,
  stats: FixturePlayerStats,
  goalsConceded: number,
): ScoreResult {
  if (stats.minutesPlayed === 0) {
    return { points: 0, breakdown: { subtotal: 0 } };
  }

  const b: Record<string, number> = {
    goals: stats.goals * 80,
    assists: stats.assists * 50,
    yellowCards: -(stats.yellowCards * 10),
    redCards: -(stats.redCards * 30),
    ownGoals: -(stats.ownGoals * 20),
    penaltiesMissed: -(stats.penaltiesMissed * 20),
    ratingBonus: ratingBonus(stats.rating),
  };

  if (position === Position.GOL || position === Position.DEF) {
    b.cleanSheet = goalsConceded === 0 && stats.minutesPlayed >= 60 ? 50 : 0;
    b.goalsConceded = -(Math.floor(goalsConceded / 2) * 10);
  }

  if (position === Position.GOL) {
    b.penaltiesSaved = stats.penaltiesSaved * 50;
  }

  const subtotal = Object.values(b).reduce((s, v) => s + v, 0);
  b.subtotal = subtotal;

  return { points: subtotal, breakdown: b };
}
