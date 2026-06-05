import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DraftStatus, Position, RoundStage } from '@wcf/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { LineupService, parseFormation } from './lineup.service';

// ─── parseFormation (pure) ─────────────────────────────────────────────────────

describe('parseFormation', () => {
  it.each([
    ['4-4-2', { def: 4, mei: 4, ata: 2 }],
    ['4-3-3', { def: 4, mei: 3, ata: 3 }],
    ['3-5-2', { def: 3, mei: 5, ata: 2 }], // mei=5 > ROSTER_QUOTAS[MEI]=4 → null
    ['5-3-2', { def: 5, mei: 3, ata: 2 }],
    ['5-4-1', { def: 5, mei: 4, ata: 1 }],
    ['4-2-4', { def: 4, mei: 2, ata: 4 }],
  ])('parses %s', (input, expected) => {
    const result = parseFormation(input);
    if (input === '3-5-2') {
      expect(result).toBeNull(); // mei=5 exceeds quota
    } else {
      expect(result).toEqual(expected);
    }
  });

  it.each([
    '4-4-3', // sum=11 ≠ 10
    '4-4', // only 2 parts
    '4-4-2-1', // 4 parts
    'abc', // NaN
    '0-5-5', // def=0 < 1
    '3-3-5', // ata=5 > 4
    '6-2-2', // def=6 > 5
  ])('returns null for invalid "%s"', (input) => {
    expect(parseFormation(input)).toBeNull();
  });
});

// ─── LineupService ─────────────────────────────────────────────────────────────

const leagueId = 'league-1';
const userId = 'user-1';
const rosterId = 'roster-1';
const roundId = 'round-1';
const membId = 'mem-1';

// Builds a minimal roster with 2 GOL + 5 DEF + 4 MEI + 4 ATA = 15 players
function buildRosterPlayers() {
  const players: { player: { id: string; position: Position } }[] = [];
  for (let i = 0; i < 2; i++) players.push({ player: { id: `gol-${i}`, position: Position.GOL } });
  for (let i = 0; i < 5; i++) players.push({ player: { id: `def-${i}`, position: Position.DEF } });
  for (let i = 0; i < 4; i++) players.push({ player: { id: `mei-${i}`, position: Position.MEI } });
  for (let i = 0; i < 4; i++) players.push({ player: { id: `ata-${i}`, position: Position.ATA } });
  return players;
}

// Builds 15 valid slots matching formation 4-4-2 with captain = gol-0
function buildValidSlots() {
  const starters = [
    { playerId: 'gol-0', slotIndex: 1, isStarter: true },
    { playerId: 'def-0', slotIndex: 2, isStarter: true },
    { playerId: 'def-1', slotIndex: 3, isStarter: true },
    { playerId: 'def-2', slotIndex: 4, isStarter: true },
    { playerId: 'def-3', slotIndex: 5, isStarter: true },
    { playerId: 'mei-0', slotIndex: 6, isStarter: true },
    { playerId: 'mei-1', slotIndex: 7, isStarter: true },
    { playerId: 'mei-2', slotIndex: 8, isStarter: true },
    { playerId: 'mei-3', slotIndex: 9, isStarter: true },
    { playerId: 'ata-0', slotIndex: 10, isStarter: true },
    { playerId: 'ata-1', slotIndex: 11, isStarter: true },
  ];
  const subs = [
    { playerId: 'gol-1', slotIndex: 12, isStarter: false },
    { playerId: 'def-4', slotIndex: 13, isStarter: false },
    { playerId: 'ata-2', slotIndex: 14, isStarter: false },
    { playerId: 'ata-3', slotIndex: 15, isStarter: false },
  ];
  return [...starters, ...subs];
}

const mockMembership = (rosterPlayers = buildRosterPlayers()) => ({
  id: membId,
  leagueId,
  userId,
  roster: { id: rosterId, rosterPlayers },
});

const mockRound = (overrides = {}) => ({
  id: roundId,
  leagueId,
  stage: RoundStage.GROUP_1,
  opensAt: new Date('2026-06-11T18:00:00Z'),
  lockAt: new Date('2026-06-11T21:00:00Z'),
  locked: false,
  ...overrides,
});

const mockLineup = () => ({
  id: 'lineup-1',
  rosterId,
  roundId,
  formation: '4-4-2',
  captainId: 'gol-0',
  updatedAt: new Date(),
  slots: buildValidSlots().map((s) => ({
    ...s,
    player: {
      id: s.playerId,
      name: `Player ${s.playerId}`,
      position: s.playerId.split('-')[0].toUpperCase(),
      photoUrl: null,
      country: { code: 'BR' },
    },
  })),
});

const mockPrisma = {
  league: { findUnique: jest.fn() },
  membership: { findUnique: jest.fn() },
  draftState: { findUnique: jest.fn() },
  round: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
  lineup: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn() },
  lineupSnapshot: { create: jest.fn() },
  $transaction: jest.fn(),
};

describe('LineupService', () => {
  let service: LineupService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LineupService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<LineupService>(LineupService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
  });

  // ── createRound ─────────────────────────────────────────────────────────────

  describe('createRound', () => {
    const dto = {
      stage: RoundStage.GROUP_1,
      opensAt: '2026-06-11T18:00:00Z',
      lockAt: '2026-06-11T21:00:00Z',
    };

    it('throws NotFoundException when league not found', async () => {
      mockPrisma.league.findUnique.mockResolvedValue(null);
      await expect(service.createRound(leagueId, userId, dto)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when called by non-owner', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ ownerId: 'other-user' });
      await expect(service.createRound(leagueId, userId, dto)).rejects.toThrow(ForbiddenException);
    });

    it('creates and returns the round when called by owner', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ ownerId: userId });
      mockPrisma.round.create.mockResolvedValue({
        id: roundId,
        leagueId,
        stage: dto.stage,
        opensAt: new Date(dto.opensAt),
        lockAt: new Date(dto.lockAt),
        locked: false,
      });

      const result = await service.createRound(leagueId, userId, dto);

      expect(mockPrisma.round.create).toHaveBeenCalled();
      expect(result.stage).toBe(RoundStage.GROUP_1);
      expect(result.locked).toBe(false);
    });
  });

  // ── lockRound ───────────────────────────────────────────────────────────────

  describe('lockRound', () => {
    it('throws ForbiddenException when called by non-owner', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ ownerId: 'other-user' });
      await expect(service.lockRound(leagueId, roundId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when round not found', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ ownerId: userId });
      mockPrisma.round.findUnique.mockResolvedValue(null);
      await expect(service.lockRound(leagueId, roundId, userId)).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when round already locked', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ ownerId: userId });
      mockPrisma.round.findUnique.mockResolvedValue(mockRound({ locked: true, lineups: [] }));
      await expect(service.lockRound(leagueId, roundId, userId)).rejects.toThrow(ConflictException);
    });

    it('creates snapshots for all submitted lineups and locks the round', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ ownerId: userId });
      const round = {
        ...mockRound(),
        lineups: [{ id: 'lineup-1', rosterId, captainId: 'gol-0', formation: '4-4-2', slots: [] }],
      };
      mockPrisma.round.findUnique.mockResolvedValue(round);
      mockPrisma.lineupSnapshot.create.mockResolvedValue({});
      mockPrisma.round.update.mockResolvedValue({});

      await service.lockRound(leagueId, roundId, userId);

      expect(mockPrisma.lineupSnapshot.create).toHaveBeenCalledTimes(1);
      expect(mockPrisma.round.update).toHaveBeenCalledWith({
        where: { id: roundId },
        data: { locked: true },
      });
    });

    it('skips snapshot creation when no lineups submitted', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ ownerId: userId });
      mockPrisma.round.findUnique.mockResolvedValue({ ...mockRound(), lineups: [] });
      mockPrisma.round.update.mockResolvedValue({});

      await service.lockRound(leagueId, roundId, userId);

      expect(mockPrisma.lineupSnapshot.create).not.toHaveBeenCalled();
      expect(mockPrisma.round.update).toHaveBeenCalled();
    });
  });

  // ── upsertLineup ────────────────────────────────────────────────────────────

  describe('upsertLineup', () => {
    const validDto = {
      formation: '4-4-2',
      captainId: 'gol-0',
      slots: buildValidSlots(),
    };

    function setupValid() {
      mockPrisma.membership.findUnique.mockResolvedValue(mockMembership());
      mockPrisma.draftState.findUnique.mockResolvedValue({ status: DraftStatus.COMPLETED });
      mockPrisma.round.findUnique.mockResolvedValue(mockRound());
      mockPrisma.lineup.findUnique.mockResolvedValue(null);
      mockPrisma.lineup.create.mockResolvedValue(mockLineup());
    }

    it('throws NotFoundException when user is not a member', async () => {
      mockPrisma.membership.findUnique.mockResolvedValue(null);
      await expect(service.upsertLineup(leagueId, roundId, userId, validDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when draft is not completed', async () => {
      mockPrisma.membership.findUnique.mockResolvedValue(mockMembership());
      mockPrisma.draftState.findUnique.mockResolvedValue({ status: DraftStatus.IN_PROGRESS });
      await expect(service.upsertLineup(leagueId, roundId, userId, validDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws NotFoundException when round not found', async () => {
      mockPrisma.membership.findUnique.mockResolvedValue(mockMembership());
      mockPrisma.draftState.findUnique.mockResolvedValue({ status: DraftStatus.COMPLETED });
      mockPrisma.round.findUnique.mockResolvedValue(null);
      await expect(service.upsertLineup(leagueId, roundId, userId, validDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ConflictException when round is locked', async () => {
      mockPrisma.membership.findUnique.mockResolvedValue(mockMembership());
      mockPrisma.draftState.findUnique.mockResolvedValue({ status: DraftStatus.COMPLETED });
      mockPrisma.round.findUnique.mockResolvedValue(mockRound({ locked: true }));
      await expect(service.upsertLineup(leagueId, roundId, userId, validDto)).rejects.toThrow(
        ConflictException,
      );
    });

    it('throws BadRequestException for invalid formation', async () => {
      mockPrisma.membership.findUnique.mockResolvedValue(mockMembership());
      mockPrisma.draftState.findUnique.mockResolvedValue({ status: DraftStatus.COMPLETED });
      mockPrisma.round.findUnique.mockResolvedValue(mockRound());
      await expect(
        service.upsertLineup(leagueId, roundId, userId, { ...validDto, formation: '4-4-3' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when wrong number of starters', async () => {
      const badSlots = buildValidSlots().map((s, i) => (i === 0 ? { ...s, isStarter: false } : s)); // removes 1 starter → 10 starters, 5 subs
      mockPrisma.membership.findUnique.mockResolvedValue(mockMembership());
      mockPrisma.draftState.findUnique.mockResolvedValue({ status: DraftStatus.COMPLETED });
      mockPrisma.round.findUnique.mockResolvedValue(mockRound());
      await expect(
        service.upsertLineup(leagueId, roundId, userId, { ...validDto, slots: badSlots }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when player is not in roster', async () => {
      const badSlots = buildValidSlots().map((s, i) =>
        i === 0 ? { ...s, playerId: 'foreign-player' } : s,
      );
      mockPrisma.membership.findUnique.mockResolvedValue(mockMembership());
      mockPrisma.draftState.findUnique.mockResolvedValue({ status: DraftStatus.COMPLETED });
      mockPrisma.round.findUnique.mockResolvedValue(mockRound());
      await expect(
        service.upsertLineup(leagueId, roundId, userId, { ...validDto, slots: badSlots }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when there are duplicate players', async () => {
      const dupSlots = buildValidSlots();
      dupSlots[1] = { ...dupSlots[1], playerId: dupSlots[0].playerId };
      mockPrisma.membership.findUnique.mockResolvedValue(mockMembership());
      mockPrisma.draftState.findUnique.mockResolvedValue({ status: DraftStatus.COMPLETED });
      mockPrisma.round.findUnique.mockResolvedValue(mockRound());
      await expect(
        service.upsertLineup(leagueId, roundId, userId, { ...validDto, slots: dupSlots }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when GOL starter count is not 1', async () => {
      // Replace GOL-0 starter with DEF player to get 0 GOL starters
      const noGolSlots = buildValidSlots().map((s) =>
        s.playerId === 'gol-0' ? { ...s, playerId: 'def-4' } : s,
      );
      // def-4 is in the subs list; swap to avoid duplicate
      const fixed = noGolSlots.map((s) =>
        s.playerId === 'def-4' && !s.isStarter ? { ...s, playerId: 'gol-0' } : s,
      );
      mockPrisma.membership.findUnique.mockResolvedValue(mockMembership());
      mockPrisma.draftState.findUnique.mockResolvedValue({ status: DraftStatus.COMPLETED });
      mockPrisma.round.findUnique.mockResolvedValue(mockRound());
      await expect(
        service.upsertLineup(leagueId, roundId, userId, { ...validDto, slots: fixed }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when formation does not match starter positions', async () => {
      // Declare 4-3-3 but provide 4-4-2 starters
      mockPrisma.membership.findUnique.mockResolvedValue(mockMembership());
      mockPrisma.draftState.findUnique.mockResolvedValue({ status: DraftStatus.COMPLETED });
      mockPrisma.round.findUnique.mockResolvedValue(mockRound());
      await expect(
        service.upsertLineup(leagueId, roundId, userId, { ...validDto, formation: '4-3-3' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when captain is not a starter', async () => {
      mockPrisma.membership.findUnique.mockResolvedValue(mockMembership());
      mockPrisma.draftState.findUnique.mockResolvedValue({ status: DraftStatus.COMPLETED });
      mockPrisma.round.findUnique.mockResolvedValue(mockRound());
      await expect(
        service.upsertLineup(leagueId, roundId, userId, { ...validDto, captainId: 'gol-1' }), // gol-1 is a sub
      ).rejects.toThrow(BadRequestException);
    });

    it('creates lineup when none exists for the round', async () => {
      setupValid();

      const result = await service.upsertLineup(leagueId, roundId, userId, validDto);

      expect(mockPrisma.lineup.create).toHaveBeenCalled();
      expect(mockPrisma.lineup.update).not.toHaveBeenCalled();
      expect(result.formation).toBe('4-4-2');
    });

    it('updates lineup and replaces slots when one already exists', async () => {
      mockPrisma.membership.findUnique.mockResolvedValue(mockMembership());
      mockPrisma.draftState.findUnique.mockResolvedValue({ status: DraftStatus.COMPLETED });
      mockPrisma.round.findUnique.mockResolvedValue(mockRound());
      mockPrisma.lineup.findUnique.mockResolvedValue({ id: 'lineup-1' }); // existing
      mockPrisma.lineup.update.mockResolvedValue(mockLineup());

      const result = await service.upsertLineup(leagueId, roundId, userId, validDto);

      expect(mockPrisma.lineup.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            slots: expect.objectContaining({ deleteMany: {} }),
          }),
        }),
      );
      expect(mockPrisma.lineup.create).not.toHaveBeenCalled();
      expect(result.formation).toBe('4-4-2');
    });
  });
});
