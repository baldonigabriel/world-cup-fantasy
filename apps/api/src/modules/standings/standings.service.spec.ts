import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { StandingsService } from './standings.service';

const leagueId = 'league-1';
const userId = 'user-1';
const roundId = 'round-1';
const round2Id = 'round-2';

const mockMembers = [
  { roster: { id: 'roster-a' }, user: { username: 'alice', teamName: 'Alice FC' } },
  { roster: { id: 'roster-b' }, user: { username: 'bob', teamName: 'Bob United' } },
  { roster: { id: 'roster-c' }, user: { username: 'carol', teamName: 'Carol XI' } },
];

const mockPrisma = {
  membership: { findUnique: jest.fn(), findMany: jest.fn() },
  teamRoundScore: { findMany: jest.fn() },
  round: { findUnique: jest.fn() },
};

describe('StandingsService', () => {
  let service: StandingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [StandingsService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<StandingsService>(StandingsService);
    jest.clearAllMocks();
    mockPrisma.membership.findUnique.mockResolvedValue({ id: 'mem-1' }); // member check passes
  });

  // ── getStandings ─────────────────────────────────────────────────────────────

  describe('getStandings', () => {
    it('throws NotFoundException when user is not a member', async () => {
      mockPrisma.membership.findUnique.mockResolvedValue(null);
      await expect(service.getStandings(leagueId, userId)).rejects.toThrow(NotFoundException);
    });

    it('returns all members with 0 points when no scores exist', async () => {
      mockPrisma.membership.findMany.mockResolvedValue(mockMembers);
      mockPrisma.teamRoundScore.findMany.mockResolvedValue([]);

      const result = await service.getStandings(leagueId, userId);

      expect(result).toHaveLength(3);
      result.forEach((entry) => {
        expect(entry.totalPoints).toBe(0);
        expect(entry.roundPoints).toEqual({});
      });
    });

    it('sums points across multiple rounds correctly', async () => {
      mockPrisma.membership.findMany.mockResolvedValue(mockMembers);
      mockPrisma.teamRoundScore.findMany.mockResolvedValue([
        { rosterId: 'roster-a', roundId, points: 800 },
        { rosterId: 'roster-a', roundId: round2Id, points: 650 },
        { rosterId: 'roster-b', roundId, points: 700 },
      ]);

      const result = await service.getStandings(leagueId, userId);

      const alice = result.find((e) => e.rosterId === 'roster-a')!;
      expect(alice.totalPoints).toBe(1450);
      expect(alice.roundPoints).toEqual({ [roundId]: 800, [round2Id]: 650 });

      const bob = result.find((e) => e.rosterId === 'roster-b')!;
      expect(bob.totalPoints).toBe(700);
    });

    it('ranks entries by totalPoints descending', async () => {
      mockPrisma.membership.findMany.mockResolvedValue(mockMembers);
      mockPrisma.teamRoundScore.findMany.mockResolvedValue([
        { rosterId: 'roster-b', roundId, points: 1000 },
        { rosterId: 'roster-a', roundId, points: 800 },
        { rosterId: 'roster-c', roundId, points: 600 },
      ]);

      const result = await service.getStandings(leagueId, userId);

      expect(result[0].rosterId).toBe('roster-b');
      expect(result[0].rank).toBe(1);
      expect(result[1].rosterId).toBe('roster-a');
      expect(result[1].rank).toBe(2);
      expect(result[2].rosterId).toBe('roster-c');
      expect(result[2].rank).toBe(3);
    });

    it('assigns same rank to tied entries and skips next rank', async () => {
      mockPrisma.membership.findMany.mockResolvedValue(mockMembers);
      mockPrisma.teamRoundScore.findMany.mockResolvedValue([
        { rosterId: 'roster-a', roundId, points: 1000 },
        { rosterId: 'roster-b', roundId, points: 1000 },
        { rosterId: 'roster-c', roundId, points: 600 },
      ]);

      const result = await service.getStandings(leagueId, userId);

      const tiedEntries = result.filter((e) => e.totalPoints === 1000);
      tiedEntries.forEach((e) => expect(e.rank).toBe(1));

      const thirdEntry = result.find((e) => e.rosterId === 'roster-c')!;
      expect(thirdEntry.rank).toBe(3); // rank 2 is skipped
    });

    it('includes teamName and username in each entry', async () => {
      mockPrisma.membership.findMany.mockResolvedValue(mockMembers);
      mockPrisma.teamRoundScore.findMany.mockResolvedValue([]);

      const result = await service.getStandings(leagueId, userId);
      const alice = result.find((e) => e.username === 'alice')!;

      expect(alice.teamName).toBe('Alice FC');
      expect(alice.username).toBe('alice');
    });
  });

  // ── getRoundStandings ─────────────────────────────────────────────────────────

  describe('getRoundStandings', () => {
    it('throws NotFoundException when round not found', async () => {
      mockPrisma.round.findUnique.mockResolvedValue(null);
      await expect(service.getRoundStandings(leagueId, roundId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns all members with 0 points when none scored in the round', async () => {
      mockPrisma.round.findUnique.mockResolvedValue({ id: roundId, leagueId });
      mockPrisma.membership.findMany.mockResolvedValue(mockMembers);
      mockPrisma.teamRoundScore.findMany.mockResolvedValue([]);

      const result = await service.getRoundStandings(leagueId, roundId, userId);

      expect(result).toHaveLength(3);
      result.forEach((e) => expect(e.totalPoints).toBe(0));
    });

    it('returns only the specified round points in roundPoints', async () => {
      mockPrisma.round.findUnique.mockResolvedValue({ id: roundId, leagueId });
      mockPrisma.membership.findMany.mockResolvedValue(mockMembers);
      mockPrisma.teamRoundScore.findMany.mockResolvedValue([
        { rosterId: 'roster-a', roundId, points: 900 },
      ]);

      const result = await service.getRoundStandings(leagueId, roundId, userId);
      const alice = result.find((e) => e.rosterId === 'roster-a')!;

      expect(alice.totalPoints).toBe(900);
      expect(alice.roundPoints).toEqual({ [roundId]: 900 });
    });
  });
});
