import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FixtureStatus, Position } from '@wcf/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { ratingBonus, scorePlayer } from './scoring.engine';
import { ScoringService } from './scoring.service';

// ─── ratingBonus (pure) ────────────────────────────────────────────────────────

describe('ratingBonus', () => {
  it.each<[number | null, number]>([
    [null, 0],
    [7.9, 0],
    [8.0, 10],
    [8.9, 10],
    [9.0, 15],
    [9.9, 15],
    [10, 20],
    [10.0, 20],
  ])('rating %s → %i', (rating, expected) => {
    expect(ratingBonus(rating)).toBe(expected);
  });
});

// ─── scorePlayer (pure) ───────────────────────────────────────────────────────

const baseStats = {
  externalId: 1,
  minutesPlayed: 90,
  rating: null,
  goals: 0,
  assists: 0,
  yellowCards: 0,
  redCards: 0,
  ownGoals: 0,
  penaltiesMissed: 0,
  penaltiesSaved: 0,
  saves: 0,
};

describe('scorePlayer', () => {
  it('returns 0 when player did not play', () => {
    const { points } = scorePlayer(Position.ATA, { ...baseStats, minutesPlayed: 0 }, 0);
    expect(points).toBe(0);
  });

  it('scores goals correctly (×80)', () => {
    const { points } = scorePlayer(Position.ATA, { ...baseStats, goals: 2 }, 0);
    expect(points).toBe(160);
  });

  it('scores assists correctly (×50)', () => {
    const { points } = scorePlayer(Position.MEI, { ...baseStats, assists: 1 }, 0);
    expect(points).toBe(50);
  });

  it('deducts yellow card (−10)', () => {
    const { points } = scorePlayer(Position.DEF, { ...baseStats, yellowCards: 1 }, 0);
    // clean sheet (60+ min, 0 conceded) = +50, yellow = −10 → 40
    expect(points).toBe(40);
  });

  it('deducts red card (−30)', () => {
    const { points } = scorePlayer(Position.ATA, { ...baseStats, redCards: 1 }, 0);
    expect(points).toBe(-30);
  });

  it('deducts own goal (−20)', () => {
    const { points } = scorePlayer(Position.ATA, { ...baseStats, ownGoals: 1 }, 0);
    expect(points).toBe(-20);
  });

  it('deducts missed penalty (−20)', () => {
    const { points } = scorePlayer(Position.ATA, { ...baseStats, penaltiesMissed: 1 }, 0);
    expect(points).toBe(-20);
  });

  // ── Clean sheet ─────────────────────────────────────────────────────────────

  it('GOL/DEF gets clean sheet bonus with 60+ min and 0 conceded', () => {
    expect(scorePlayer(Position.GOL, { ...baseStats, minutesPlayed: 60 }, 0).points).toBe(50);
    expect(scorePlayer(Position.DEF, { ...baseStats, minutesPlayed: 90 }, 0).points).toBe(50);
  });

  it('clean sheet NOT awarded with 59 min even if 0 conceded', () => {
    const { points } = scorePlayer(Position.GOL, { ...baseStats, minutesPlayed: 59 }, 0);
    expect(points).toBe(0);
  });

  it('MEI/ATA do not get clean sheet', () => {
    expect(scorePlayer(Position.MEI, { ...baseStats, minutesPlayed: 90 }, 0).points).toBe(0);
    expect(scorePlayer(Position.ATA, { ...baseStats, minutesPlayed: 90 }, 0).points).toBe(0);
  });

  // ── Goals conceded ──────────────────────────────────────────────────────────

  it('0–1 goals conceded → 0 deduction', () => {
    expect(scorePlayer(Position.GOL, baseStats, 0).points).toBe(50); // also clean sheet
    expect(scorePlayer(Position.GOL, baseStats, 1).points).toBe(0); // no clean sheet, no deduction
  });

  it('2–3 goals conceded → −10', () => {
    expect(scorePlayer(Position.DEF, baseStats, 2).points).toBe(-10);
    expect(scorePlayer(Position.DEF, baseStats, 3).points).toBe(-10);
  });

  it('4–5 goals conceded → −20', () => {
    expect(scorePlayer(Position.GOL, baseStats, 4).points).toBe(-20);
    expect(scorePlayer(Position.GOL, baseStats, 5).points).toBe(-20);
  });

  it('MEI/ATA are not penalised for goals conceded', () => {
    expect(scorePlayer(Position.MEI, baseStats, 5).points).toBe(0);
    expect(scorePlayer(Position.ATA, baseStats, 5).points).toBe(0);
  });

  // ── Penalty saved (GOL only) ─────────────────────────────────────────────────

  it('GOL scores penalty saved (+50)', () => {
    const { points } = scorePlayer(Position.GOL, { ...baseStats, penaltiesSaved: 1 }, 0);
    // clean sheet + penalty saved = 50 + 50 = 100
    expect(points).toBe(100);
  });

  it('non-GOL does not score penalty saved', () => {
    const { points } = scorePlayer(Position.DEF, { ...baseStats, penaltiesSaved: 1 }, 0);
    expect(points).toBe(50); // only clean sheet
  });

  // ── Rating bonus ─────────────────────────────────────────────────────────────

  it('applies rating bonus correctly', () => {
    expect(scorePlayer(Position.ATA, { ...baseStats, rating: 8.5 }, 0).points).toBe(10);
    expect(scorePlayer(Position.ATA, { ...baseStats, rating: 9.0 }, 0).points).toBe(15);
    expect(scorePlayer(Position.ATA, { ...baseStats, rating: 10 }, 0).points).toBe(20);
    expect(scorePlayer(Position.ATA, { ...baseStats, rating: null }, 0).points).toBe(0);
  });

  // ── Breakdown ───────────────────────────────────────────────────────────────

  it('breakdown subtotal equals points', () => {
    const { points, breakdown } = scorePlayer(
      Position.ATA,
      { ...baseStats, goals: 1, assists: 1, yellowCards: 1, rating: 8.0 },
      0,
    );
    expect(breakdown.subtotal).toBe(points);
    expect(points).toBe(80 + 50 - 10 + 10); // 130
  });
});

// ─── ScoringService ────────────────────────────────────────────────────────────

const leagueId = 'league-1';
const roundId = 'round-1';
const userId = 'user-1';
const rosterId = 'roster-1';
const snapshotId = 'snap-1';

const mockPrisma = {
  league: { findUnique: jest.fn() },
  membership: { findUnique: jest.fn() },
  round: { findUnique: jest.fn() },
  fixtureFacts: { findMany: jest.fn() },
  lineupSnapshot: { findMany: jest.fn() },
  playerRoundScore: { upsert: jest.fn() },
  teamRoundScore: { findMany: jest.fn(), upsert: jest.fn() },
  $transaction: jest.fn(),
};

const brazilCountryId = 'country-bra';
const viniExternalId = 42;

function makeSnapshot(captainPlayerId: string) {
  return {
    id: snapshotId,
    rosterId,
    captainId: captainPlayerId,
    slots: [
      {
        isStarter: true,
        player: {
          id: 'player-gol',
          externalId: 10,
          position: Position.GOL,
          countryId: brazilCountryId,
          name: 'Ederson',
        },
      },
      {
        isStarter: true,
        player: {
          id: 'player-ata',
          externalId: viniExternalId,
          position: Position.ATA,
          countryId: brazilCountryId,
          name: 'Vini Jr',
        },
      },
    ],
  };
}

function makeFixture(goalsConceded = 0) {
  return [
    {
      homeCountryId: brazilCountryId,
      awayCountryId: 'country-arg',
      status: FixtureStatus.FINISHED,
      payload: {
        homeTeam: {
          countryCode: 'BRA',
          goalsConceded,
          players: [
            {
              externalId: 10,
              minutesPlayed: 90,
              rating: null,
              goals: 0,
              assists: 0,
              yellowCards: 0,
              redCards: 0,
              ownGoals: 0,
              penaltiesMissed: 0,
              penaltiesSaved: 0,
              saves: 0,
            },
            {
              externalId: viniExternalId,
              minutesPlayed: 90,
              rating: 9.0,
              goals: 1,
              assists: 1,
              yellowCards: 0,
              redCards: 0,
              ownGoals: 0,
              penaltiesMissed: 0,
              penaltiesSaved: 0,
              saves: 0,
            },
          ],
        },
        awayTeam: { countryCode: 'ARG', goalsConceded: 1, players: [] },
      },
    },
  ];
}

describe('ScoringService', () => {
  let service: ScoringService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ScoringService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<ScoringService>(ScoringService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
  });

  // ── scoreRound ───────────────────────────────────────────────────────────────

  describe('scoreRound', () => {
    it('throws ForbiddenException when called by non-owner', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ ownerId: 'other-user' });
      await expect(service.scoreRound(leagueId, roundId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when round not found', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ ownerId: userId });
      mockPrisma.round.findUnique.mockResolvedValue(null);
      await expect(service.scoreRound(leagueId, roundId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when round is not locked', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ ownerId: userId });
      mockPrisma.round.findUnique.mockResolvedValue({ id: roundId, leagueId, locked: false });
      await expect(service.scoreRound(leagueId, roundId, userId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('calculates correct points for a normal player', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ ownerId: userId });
      mockPrisma.round.findUnique.mockResolvedValue({ id: roundId, leagueId, locked: true });
      mockPrisma.fixtureFacts.findMany.mockResolvedValue(makeFixture(0));
      mockPrisma.lineupSnapshot.findMany.mockResolvedValue([makeSnapshot('player-gol')]);
      mockPrisma.playerRoundScore.upsert.mockResolvedValue({});
      mockPrisma.teamRoundScore.upsert.mockResolvedValue({});

      await service.scoreRound(leagueId, roundId, userId);

      // player-gol: GOL, 0 conceded, clean sheet = 50 pts
      // player-ata: ATA, 1 goal (80) + 1 assist (50) + rating 9.0 (15) = 145 pts, captain → ×2 = 290 pts
      // Wait: captain = 'player-gol' in makeSnapshot('player-gol')
      // player-gol: clean sheet = 50, is captain → 100
      // player-ata: 80 + 50 + 15 = 145, not captain → 145
      const upsertCalls = mockPrisma.playerRoundScore.upsert.mock.calls;
      const golCall = upsertCalls.find(
        (c: unknown[]) =>
          (c[0] as { where: { roundId_rosterId_playerId: { playerId: string } } }).where
            .roundId_rosterId_playerId.playerId === 'player-gol',
      );
      const ataCall = upsertCalls.find(
        (c: unknown[]) =>
          (c[0] as { where: { roundId_rosterId_playerId: { playerId: string } } }).where
            .roundId_rosterId_playerId.playerId === 'player-ata',
      );

      expect(golCall[0].create.points).toBe(100); // 50 × 2 (captain)
      expect(golCall[0].create.isCaptain).toBe(true);
      expect(ataCall[0].create.points).toBe(145); // not captain
      expect(ataCall[0].create.isCaptain).toBe(false);
    });

    it('scores 0 for a player whose country has no fixture', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ ownerId: userId });
      mockPrisma.round.findUnique.mockResolvedValue({ id: roundId, leagueId, locked: true });
      mockPrisma.fixtureFacts.findMany.mockResolvedValue([]); // no fixtures
      mockPrisma.lineupSnapshot.findMany.mockResolvedValue([makeSnapshot('player-ata')]);
      mockPrisma.playerRoundScore.upsert.mockResolvedValue({});
      mockPrisma.teamRoundScore.upsert.mockResolvedValue({});

      await service.scoreRound(leagueId, roundId, userId);

      const upsertCalls = mockPrisma.playerRoundScore.upsert.mock.calls;
      upsertCalls.forEach((call: unknown[]) => {
        expect((call[0] as { create: { points: number } }).create.points).toBe(0);
      });
    });

    it('captain doubles points including negatives', async () => {
      // player-ata gets a red card (−30) and is captain → −60
      const fixture = makeFixture(0);
      fixture[0].payload.homeTeam.players[1] = {
        ...fixture[0].payload.homeTeam.players[1],
        goals: 0,
        assists: 0,
        rating: null,
        redCards: 1,
      };

      mockPrisma.league.findUnique.mockResolvedValue({ ownerId: userId });
      mockPrisma.round.findUnique.mockResolvedValue({ id: roundId, leagueId, locked: true });
      mockPrisma.fixtureFacts.findMany.mockResolvedValue(fixture);
      mockPrisma.lineupSnapshot.findMany.mockResolvedValue([makeSnapshot('player-ata')]); // ATA is captain
      mockPrisma.playerRoundScore.upsert.mockResolvedValue({});
      mockPrisma.teamRoundScore.upsert.mockResolvedValue({});

      await service.scoreRound(leagueId, roundId, userId);

      const upsertCalls = mockPrisma.playerRoundScore.upsert.mock.calls;
      const ataCall = upsertCalls.find(
        (c: unknown[]) =>
          (c[0] as { where: { roundId_rosterId_playerId: { playerId: string } } }).where
            .roundId_rosterId_playerId.playerId === 'player-ata',
      );
      expect(ataCall[0].create.points).toBe(-60); // −30 × 2 (captain)
      expect(ataCall[0].create.isCaptain).toBe(true);
    });

    it('is idempotent — calling twice upserts with the same values', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ ownerId: userId });
      mockPrisma.round.findUnique.mockResolvedValue({ id: roundId, leagueId, locked: true });
      mockPrisma.fixtureFacts.findMany.mockResolvedValue(makeFixture(0));
      mockPrisma.lineupSnapshot.findMany.mockResolvedValue([makeSnapshot('player-gol')]);
      mockPrisma.playerRoundScore.upsert.mockResolvedValue({});
      mockPrisma.teamRoundScore.upsert.mockResolvedValue({});

      await service.scoreRound(leagueId, roundId, userId);
      const firstCallArgs = mockPrisma.playerRoundScore.upsert.mock.calls.map(
        (c: unknown[]) => (c[0] as { create: { points: number } }).create.points,
      );

      jest.clearAllMocks();
      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
      );
      mockPrisma.league.findUnique.mockResolvedValue({ ownerId: userId });
      mockPrisma.round.findUnique.mockResolvedValue({ id: roundId, leagueId, locked: true });
      mockPrisma.fixtureFacts.findMany.mockResolvedValue(makeFixture(0));
      mockPrisma.lineupSnapshot.findMany.mockResolvedValue([makeSnapshot('player-gol')]);
      mockPrisma.playerRoundScore.upsert.mockResolvedValue({});
      mockPrisma.teamRoundScore.upsert.mockResolvedValue({});

      await service.scoreRound(leagueId, roundId, userId);
      const secondCallArgs = mockPrisma.playerRoundScore.upsert.mock.calls.map(
        (c: unknown[]) => (c[0] as { create: { points: number } }).create.points,
      );

      expect(firstCallArgs).toEqual(secondCallArgs);
    });

    it('cancelled fixture zeroes player and team scores on re-score', async () => {
      // First run: fixture FINISHED → scores > 0
      mockPrisma.league.findUnique.mockResolvedValue({ ownerId: userId });
      mockPrisma.round.findUnique.mockResolvedValue({ id: roundId, leagueId, locked: true });
      mockPrisma.fixtureFacts.findMany.mockResolvedValue(makeFixture(0));
      mockPrisma.lineupSnapshot.findMany.mockResolvedValue([makeSnapshot('player-gol')]);
      mockPrisma.playerRoundScore.upsert.mockResolvedValue({});
      mockPrisma.teamRoundScore.upsert.mockResolvedValue({});

      await service.scoreRound(leagueId, roundId, userId);

      const firstRunPoints = mockPrisma.playerRoundScore.upsert.mock.calls.map(
        (c: unknown[]) => (c[0] as { create: { points: number } }).create.points,
      );
      expect(firstRunPoints.some((p) => p > 0)).toBe(true);
      const firstTeamPoints = (
        mockPrisma.teamRoundScore.upsert.mock.calls[0][0] as { create: { points: number } }
      ).create.points;
      expect(firstTeamPoints).toBeGreaterThan(0);

      // Second run: same fixture now CANCELLED — filtered out by status: FINISHED query → empty
      jest.clearAllMocks();
      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
      );
      mockPrisma.league.findUnique.mockResolvedValue({ ownerId: userId });
      mockPrisma.round.findUnique.mockResolvedValue({ id: roundId, leagueId, locked: true });
      mockPrisma.fixtureFacts.findMany.mockResolvedValue([]);
      mockPrisma.lineupSnapshot.findMany.mockResolvedValue([makeSnapshot('player-gol')]);
      mockPrisma.playerRoundScore.upsert.mockResolvedValue({});
      mockPrisma.teamRoundScore.upsert.mockResolvedValue({});

      await service.scoreRound(leagueId, roundId, userId);

      const secondRunPoints = mockPrisma.playerRoundScore.upsert.mock.calls.map(
        (c: unknown[]) => (c[0] as { create: { points: number } }).create.points,
      );
      expect(secondRunPoints.every((p) => p === 0)).toBe(true);
      const secondTeamPoints = (
        mockPrisma.teamRoundScore.upsert.mock.calls[0][0] as { create: { points: number } }
      ).create.points;
      expect(secondTeamPoints).toBe(0);
    });

    it('upserts TeamRoundScore equal to the sum of PlayerRoundScores', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ ownerId: userId });
      mockPrisma.round.findUnique.mockResolvedValue({ id: roundId, leagueId, locked: true });
      mockPrisma.fixtureFacts.findMany.mockResolvedValue(makeFixture(0));
      mockPrisma.lineupSnapshot.findMany.mockResolvedValue([makeSnapshot('player-gol')]);
      mockPrisma.playerRoundScore.upsert.mockResolvedValue({});
      mockPrisma.teamRoundScore.upsert.mockResolvedValue({});

      await service.scoreRound(leagueId, roundId, userId);

      // GOL: 50 × 2 (captain) = 100; ATA: 80 + 50 + 15 = 145 → team total = 245
      const teamUpsert = mockPrisma.teamRoundScore.upsert.mock.calls[0][0];
      expect(teamUpsert.create.points).toBe(100 + 145);
    });
  });
});
