import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FixtureStatus } from '@wcf/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { MatchesService } from './matches.service';

const fixtureId = 123456;
const leagueId = 'league-1';
const roundId = 'round-1';
const userId = 'user-1';

const baseDto = {
  fixtureId,
  status: FixtureStatus.FINISHED,
  homeTeam: {
    countryCode: 'BRA',
    goalsConceded: 0,
    players: [
      {
        externalId: 1,
        minutesPlayed: 90,
        rating: 8.5,
        goals: 1,
        assists: 0,
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
};

const mockPrisma = {
  country: { findUnique: jest.fn() },
  fixtureFacts: { upsert: jest.fn(), findUnique: jest.fn() },
  fixtureRound: {
    upsert: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
  },
  round: { findUnique: jest.fn() },
  league: { findUnique: jest.fn() },
  $transaction: jest.fn(),
};

describe('MatchesService', () => {
  let service: MatchesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [MatchesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<MatchesService>(MatchesService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
  });

  // ── ingestFixture ────────────────────────────────────────────────────────────

  describe('ingestFixture', () => {
    it('throws NotFoundException when home country not found', async () => {
      mockPrisma.country.findUnique.mockResolvedValueOnce(null);
      mockPrisma.country.findUnique.mockResolvedValueOnce({ id: 'arg', code: 'ARG' });
      await expect(service.ingestFixture(baseDto)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when away country not found', async () => {
      mockPrisma.country.findUnique.mockResolvedValueOnce({ id: 'bra', code: 'BRA' });
      mockPrisma.country.findUnique.mockResolvedValueOnce(null);
      await expect(service.ingestFixture(baseDto)).rejects.toThrow(NotFoundException);
    });

    it('upserts fixture and returns response', async () => {
      mockPrisma.country.findUnique
        .mockResolvedValueOnce({ id: 'bra', code: 'BRA' })
        .mockResolvedValueOnce({ id: 'arg', code: 'ARG' });
      mockPrisma.fixtureFacts.upsert.mockResolvedValue({
        fixtureId,
        status: FixtureStatus.FINISHED,
        fetchedAt: new Date('2026-06-11T00:00:00Z'),
      });

      const result = await service.ingestFixture(baseDto);

      expect(mockPrisma.fixtureFacts.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { fixtureId } }),
      );
      expect(result.fixtureId).toBe(fixtureId);
      expect(result.homeCountryCode).toBe('BRA');
    });

    it('creates FixtureRound link when roundId is provided', async () => {
      mockPrisma.country.findUnique
        .mockResolvedValueOnce({ id: 'bra', code: 'BRA' })
        .mockResolvedValueOnce({ id: 'arg', code: 'ARG' });
      mockPrisma.fixtureFacts.upsert.mockResolvedValue({
        fixtureId,
        status: FixtureStatus.FINISHED,
        fetchedAt: new Date(),
      });
      mockPrisma.fixtureRound.upsert.mockResolvedValue({});

      await service.ingestFixture({ ...baseDto, roundId });

      expect(mockPrisma.fixtureRound.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { fixtureId_roundId: { fixtureId, roundId } } }),
      );
    });

    it('does not create FixtureRound link when roundId is absent', async () => {
      mockPrisma.country.findUnique
        .mockResolvedValueOnce({ id: 'bra', code: 'BRA' })
        .mockResolvedValueOnce({ id: 'arg', code: 'ARG' });
      mockPrisma.fixtureFacts.upsert.mockResolvedValue({
        fixtureId,
        status: FixtureStatus.FINISHED,
        fetchedAt: new Date(),
      });

      await service.ingestFixture(baseDto);

      expect(mockPrisma.fixtureRound.upsert).not.toHaveBeenCalled();
    });
  });

  // ── linkToRound ──────────────────────────────────────────────────────────────

  describe('linkToRound', () => {
    it('throws ForbiddenException when called by non-owner', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ ownerId: 'other-user' });
      await expect(service.linkToRound(leagueId, roundId, fixtureId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when round not found', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ ownerId: userId });
      mockPrisma.round.findUnique.mockResolvedValue(null);
      await expect(service.linkToRound(leagueId, roundId, fixtureId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when fixture not ingested yet', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ ownerId: userId });
      mockPrisma.round.findUnique.mockResolvedValue({ id: roundId, leagueId });
      mockPrisma.fixtureFacts.findUnique.mockResolvedValue(null);
      await expect(service.linkToRound(leagueId, roundId, fixtureId, userId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when fixture already linked', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ ownerId: userId });
      mockPrisma.round.findUnique.mockResolvedValue({ id: roundId, leagueId });
      mockPrisma.fixtureFacts.findUnique.mockResolvedValue({ fixtureId });
      mockPrisma.fixtureRound.findUnique.mockResolvedValue({ fixtureId, roundId });
      await expect(service.linkToRound(leagueId, roundId, fixtureId, userId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('links fixture to round successfully', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ ownerId: userId });
      mockPrisma.round.findUnique.mockResolvedValue({ id: roundId, leagueId });
      mockPrisma.fixtureFacts.findUnique.mockResolvedValue({ fixtureId });
      mockPrisma.fixtureRound.findUnique.mockResolvedValue(null);
      mockPrisma.fixtureRound.create.mockResolvedValue({});

      await service.linkToRound(leagueId, roundId, fixtureId, userId);

      expect(mockPrisma.fixtureRound.create).toHaveBeenCalledWith({
        data: { fixtureId, roundId },
      });
    });
  });
});
