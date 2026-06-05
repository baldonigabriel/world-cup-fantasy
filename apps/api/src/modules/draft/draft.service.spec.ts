import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DraftStatus, Position, ROSTER_QUOTAS } from '@wcf/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { DraftService, resolvePickingMembership } from './draft.service';

// ─── resolvePickingMembership (pure function) ─────────────────────────────────

describe('resolvePickingMembership', () => {
  const order4 = ['A', 'B', 'C', 'D'];

  it('round 0 (even) goes left→right', () => {
    expect(resolvePickingMembership(0, order4)).toBe('A');
    expect(resolvePickingMembership(1, order4)).toBe('B');
    expect(resolvePickingMembership(2, order4)).toBe('C');
    expect(resolvePickingMembership(3, order4)).toBe('D');
  });

  it('round 1 (odd) reverses right→left', () => {
    expect(resolvePickingMembership(4, order4)).toBe('D');
    expect(resolvePickingMembership(5, order4)).toBe('C');
    expect(resolvePickingMembership(6, order4)).toBe('B');
    expect(resolvePickingMembership(7, order4)).toBe('A');
  });

  it('round 2 (even) goes left→right again', () => {
    expect(resolvePickingMembership(8, order4)).toBe('A');
    expect(resolvePickingMembership(11, order4)).toBe('D');
  });

  it('N=8 — first pick is order[0], pick 7 is order[7], pick 8 reverses to order[7]', () => {
    const order8 = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8'];
    expect(resolvePickingMembership(0, order8)).toBe('m1');
    expect(resolvePickingMembership(7, order8)).toBe('m8');
    expect(resolvePickingMembership(8, order8)).toBe('m8'); // round 1 starts from end
    expect(resolvePickingMembership(15, order8)).toBe('m1');
    expect(resolvePickingMembership(16, order8)).toBe('m1'); // round 2 repeats round 0
  });

  it('covers all 15 rounds for N=8 with no out-of-range index', () => {
    const order8 = Array.from({ length: 8 }, (_, i) => `m${i + 1}`);
    const totalPicks = 8 * 15;
    for (let i = 0; i < totalPicks; i++) {
      const result = resolvePickingMembership(i, order8);
      expect(order8).toContain(result);
    }
  });
});

// ─── DraftService ─────────────────────────────────────────────────────────────

const leagueId = 'league-1';
const userId = 'user-1';
const membId = 'mem-1';
const rosterId = 'roster-1';

const mockDraftState = (overrides = {}) => ({
  id: 'draft-1',
  leagueId,
  status: DraftStatus.IN_PROGRESS,
  order: [membId, 'mem-2'],
  currentPick: 0,
  updatedAt: new Date(),
  createdAt: new Date(),
  ...overrides,
});

const mockPlayer = (pos: Position = Position.ATA, countryId = 'country-br') => ({
  id: 'player-1',
  name: 'Vini Jr',
  position: pos,
  countryId,
  externalId: 1,
  photoUrl: null,
  country: { name: 'Brazil', code: 'Brazil' },
});

const mockMembership = (rosterPlayers: unknown[] = []) => ({
  id: membId,
  leagueId,
  userId,
  roster: {
    id: rosterId,
    rosterPlayers,
  },
});

const mockPrisma = {
  league: { findUnique: jest.fn() },
  draftState: { findUnique: jest.fn(), update: jest.fn() },
  membership: { findUnique: jest.fn() },
  player: { findUnique: jest.fn(), count: jest.fn() },
  rosterPlayer: { findUnique: jest.fn(), create: jest.fn() },
  draftPick: { create: jest.fn() },
  $transaction: jest.fn(),
};

describe('DraftService', () => {
  let service: DraftService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DraftService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<DraftService>(DraftService);
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
  });

  // ── startDraft ──────────────────────────────────────────────────────────────

  describe('startDraft', () => {
    it('throws ForbiddenException when called by non-owner', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ ownerId: 'other-user' });

      await expect(service.startDraft(leagueId, userId)).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when draft order not drawn', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ ownerId: userId });
      mockPrisma.draftState.findUnique.mockResolvedValue(null);

      await expect(service.startDraft(leagueId, userId)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when already in progress', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ ownerId: userId });
      mockPrisma.draftState.findUnique.mockResolvedValue(
        mockDraftState({ status: DraftStatus.IN_PROGRESS }),
      );

      await expect(service.startDraft(leagueId, userId)).rejects.toThrow(ConflictException);
    });

    it('sets status to IN_PROGRESS when called by owner with PENDING state', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ ownerId: userId });
      mockPrisma.draftState.findUnique.mockResolvedValue(
        mockDraftState({ status: DraftStatus.PENDING }),
      );
      mockPrisma.draftState.update.mockResolvedValue({});

      await service.startDraft(leagueId, userId);

      expect(mockPrisma.draftState.update).toHaveBeenCalledWith({
        where: { leagueId },
        data: { status: DraftStatus.IN_PROGRESS },
      });
    });
  });

  // ── pick ────────────────────────────────────────────────────────────────────

  describe('pick', () => {
    function setupValidPick(pos: Position = Position.ATA, existingRoster: unknown[] = []) {
      const state = mockDraftState();
      mockPrisma.draftState.findUnique
        .mockResolvedValueOnce(state) // inside transaction
        .mockResolvedValueOnce({ ...state, currentPick: 1, picks: [] }); // for getState

      mockPrisma.membership.findUnique.mockResolvedValue(mockMembership(existingRoster));
      mockPrisma.player.findUnique.mockResolvedValue(mockPlayer(pos));
      mockPrisma.rosterPlayer.findUnique.mockResolvedValue(null);
      mockPrisma.player.count.mockResolvedValue(100); // plenty available
      mockPrisma.rosterPlayer.create.mockResolvedValue({});
      mockPrisma.draftPick.create.mockResolvedValue({});
      mockPrisma.draftState.update.mockResolvedValue({ ...state, currentPick: 1 });
    }

    it('throws ConflictException when draft is not in progress', async () => {
      mockPrisma.draftState.findUnique.mockResolvedValue(
        mockDraftState({ status: DraftStatus.PENDING }),
      );

      await expect(service.pick(leagueId, userId, 'player-1')).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when it is not the user turn', async () => {
      mockPrisma.draftState.findUnique.mockResolvedValue(
        mockDraftState({ order: ['mem-other', membId] }), // mem-other picks first
      );
      mockPrisma.membership.findUnique.mockResolvedValue(mockMembership());

      await expect(service.pick(leagueId, userId, 'player-1')).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when user is not in league', async () => {
      mockPrisma.draftState.findUnique.mockResolvedValue(mockDraftState());
      mockPrisma.membership.findUnique.mockResolvedValue(null);

      await expect(service.pick(leagueId, userId, 'player-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when player is already drafted', async () => {
      mockPrisma.draftState.findUnique.mockResolvedValue(mockDraftState());
      mockPrisma.membership.findUnique.mockResolvedValue(mockMembership());
      mockPrisma.player.findUnique.mockResolvedValue(mockPlayer());
      mockPrisma.rosterPlayer.findUnique.mockResolvedValue({ id: 'rp-1' }); // already drafted

      await expect(service.pick(leagueId, userId, 'player-1')).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when position quota is full', async () => {
      // ATA quota is 4 — fill it up
      const fullAtaRoster = Array.from({ length: ROSTER_QUOTAS[Position.ATA] }, (_, i) => ({
        countryId: `country-${i}`,
        player: { position: Position.ATA },
      }));

      mockPrisma.draftState.findUnique.mockResolvedValue(mockDraftState());
      mockPrisma.membership.findUnique.mockResolvedValue(mockMembership(fullAtaRoster));
      mockPrisma.player.findUnique.mockResolvedValue(mockPlayer(Position.ATA, 'country-new'));
      mockPrisma.rosterPlayer.findUnique.mockResolvedValue(null);

      await expect(service.pick(leagueId, userId, 'player-1')).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when team already has player from same country', async () => {
      const rosterWithBrazil = [{ countryId: 'country-br', player: { position: Position.DEF } }];

      mockPrisma.draftState.findUnique.mockResolvedValue(mockDraftState());
      mockPrisma.membership.findUnique.mockResolvedValue(mockMembership(rosterWithBrazil));
      mockPrisma.player.findUnique.mockResolvedValue(mockPlayer(Position.ATA, 'country-br'));
      mockPrisma.rosterPlayer.findUnique.mockResolvedValue(null);

      await expect(service.pick(leagueId, userId, 'player-1')).rejects.toThrow(ConflictException);
    });

    it('executes valid pick and advances currentPick', async () => {
      setupValidPick();

      await service.pick(leagueId, userId, 'player-1');

      expect(mockPrisma.rosterPlayer.create).toHaveBeenCalled();
      expect(mockPrisma.draftPick.create).toHaveBeenCalled();
      expect(mockPrisma.draftState.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currentPick: 1 }),
        }),
      );
    });

    it('sets status to COMPLETED on the last pick', async () => {
      const N = 2; // 2 teams
      const totalPicks = N * 15;
      // currentPick = totalPicks - 1 means this is the last pick
      const state = mockDraftState({ order: [membId, 'mem-2'], currentPick: totalPicks - 1 });

      // The last pick goes to the team that picks at position totalPicks-1
      const expectedMembId = resolvePickingMembership(totalPicks - 1, [membId, 'mem-2']);

      mockPrisma.draftState.findUnique
        .mockResolvedValueOnce(state)
        .mockResolvedValueOnce({
          ...state,
          currentPick: totalPicks,
          status: DraftStatus.COMPLETED,
          picks: [],
        });

      // Adjust membership mock to match who's actually picking
      mockPrisma.membership.findUnique.mockResolvedValue({
        ...mockMembership(),
        id: expectedMembId,
      });
      mockPrisma.player.findUnique.mockResolvedValue(mockPlayer());
      mockPrisma.rosterPlayer.findUnique.mockResolvedValue(null);
      mockPrisma.player.count.mockResolvedValue(100);
      mockPrisma.rosterPlayer.create.mockResolvedValue({});
      mockPrisma.draftPick.create.mockResolvedValue({});
      mockPrisma.draftState.update.mockResolvedValue({});

      await service.pick(leagueId, expectedMembId, 'player-1');

      expect(mockPrisma.draftState.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: DraftStatus.COMPLETED }),
        }),
      );
    });
  });
});
