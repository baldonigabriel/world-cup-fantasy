import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TradeStatus } from '@wcf/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { TradesService } from './trades.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const leagueId = 'league-1';
const userId = 'user-1';
const otherUserId = 'user-2';
const proposerRosterId = 'roster-a';
const receiverRosterId = 'roster-b';
const tradeId = 'trade-1';

const playerMEI_BRA = {
  id: 'p-mei-bra',
  name: 'Neymar',
  position: 'MEI',
  countryId: 'BRA',
  country: { code: 'BRA', name: 'Brazil' },
};
const playerMEI_ARG = {
  id: 'p-mei-arg',
  name: 'Messi',
  position: 'MEI',
  countryId: 'ARG',
  country: { code: 'ARG', name: 'Argentina' },
};
const playerGOL_FRA = {
  id: 'p-gol-fra',
  name: 'Lloris',
  position: 'GOL',
  countryId: 'FRA',
  country: { code: 'FRA', name: 'France' },
};

const rpProposer = {
  id: 'rp-1',
  rosterId: proposerRosterId,
  playerId: playerMEI_BRA.id,
  leagueId,
  countryId: 'BRA',
  player: playerMEI_BRA,
};
const rpReceiver = {
  id: 'rp-2',
  rosterId: receiverRosterId,
  playerId: playerMEI_ARG.id,
  leagueId,
  countryId: 'ARG',
  player: playerMEI_ARG,
};

const activeWindow = {
  id: 'win-1',
  leagueId,
  opensAt: new Date(Date.now() - 3600_000),
  closesAt: new Date(Date.now() + 3600_000),
};
const closedWindow = null;

const pendingTrade = {
  id: tradeId,
  leagueId,
  status: TradeStatus.PENDING,
  proposerRosterId,
  receiverRosterId,
  tradeWindowId: 'win-1',
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [
    {
      id: 'item-1',
      tradeId,
      playerId: playerMEI_BRA.id,
      fromRosterId: proposerRosterId,
      toRosterId: receiverRosterId,
    },
    {
      id: 'item-2',
      tradeId,
      playerId: playerMEI_ARG.id,
      fromRosterId: receiverRosterId,
      toRosterId: proposerRosterId,
    },
  ],
};

// ── Mock Prisma ────────────────────────────────────────────────────────────────

const mockPrisma = {
  league: { findUnique: jest.fn() },
  tradeWindow: { create: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
  membership: { findUnique: jest.fn() },
  roster: { findFirst: jest.fn() },
  rosterPlayer: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    create: jest.fn(),
  },
  trade: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn() },
  player: { findUnique: jest.fn(), findMany: jest.fn() },
  $transaction: jest.fn(),
};

const membershipProposer = { id: 'mem-1', roster: { id: proposerRosterId } };
const membershipReceiver = { id: 'mem-2', roster: { id: receiverRosterId } };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TradesService', () => {
  let service: TradesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TradesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<TradesService>(TradesService);
    jest.resetAllMocks();
  });

  // ── createTradeWindow ───────────────────────────────────────────────────────

  describe('createTradeWindow', () => {
    it('throws NotFoundException when league not found', async () => {
      mockPrisma.league.findUnique.mockResolvedValue(null);
      await expect(
        service.createTradeWindow(leagueId, userId, {
          opensAt: '2026-06-20T00:00:00Z',
          closesAt: '2026-06-24T00:00:00Z',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when user is not the owner', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ id: leagueId, ownerId: 'other-user' });
      await expect(
        service.createTradeWindow(leagueId, userId, {
          opensAt: '2026-06-20T00:00:00Z',
          closesAt: '2026-06-24T00:00:00Z',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when closesAt <= opensAt', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ id: leagueId, ownerId: userId });
      await expect(
        service.createTradeWindow(leagueId, userId, {
          opensAt: '2026-06-24T00:00:00Z',
          closesAt: '2026-06-20T00:00:00Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates a trade window', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({ id: leagueId, ownerId: userId });
      mockPrisma.tradeWindow.create.mockResolvedValue(activeWindow);

      const result = await service.createTradeWindow(leagueId, userId, {
        opensAt: '2026-06-20T00:00:00Z',
        closesAt: '2026-06-24T00:00:00Z',
      });

      expect(mockPrisma.tradeWindow.create).toHaveBeenCalledTimes(1);
      expect(result.id).toBe(activeWindow.id);
    });
  });

  // ── proposeTrade ────────────────────────────────────────────────────────────

  describe('proposeTrade', () => {
    const dto = {
      offeredPlayerId: playerMEI_BRA.id,
      requestedPlayerId: playerMEI_ARG.id,
      receiverRosterId,
    };

    it('throws ConflictException when no active window', async () => {
      mockPrisma.tradeWindow.findFirst.mockResolvedValue(closedWindow);
      await expect(service.proposeTrade(leagueId, userId, dto)).rejects.toThrow(ConflictException);
    });

    it('throws BadRequestException when trading with yourself', async () => {
      mockPrisma.tradeWindow.findFirst.mockResolvedValue(activeWindow);
      mockPrisma.membership.findUnique.mockResolvedValue(membershipProposer);
      await expect(
        service.proposeTrade(leagueId, userId, { ...dto, receiverRosterId: proposerRosterId }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when offered player is not in proposer roster', async () => {
      mockPrisma.tradeWindow.findFirst.mockResolvedValue(activeWindow);
      mockPrisma.membership.findUnique.mockResolvedValue(membershipProposer);
      mockPrisma.roster.findFirst.mockResolvedValue({ id: receiverRosterId });
      // rosterPlayer with wrong rosterId
      mockPrisma.rosterPlayer.findUnique
        .mockResolvedValueOnce({ ...rpProposer, rosterId: 'someone-else' })
        .mockResolvedValueOnce(rpReceiver);

      await expect(service.proposeTrade(leagueId, userId, dto)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when requested player is not in receiver roster', async () => {
      mockPrisma.tradeWindow.findFirst.mockResolvedValue(activeWindow);
      mockPrisma.membership.findUnique.mockResolvedValue(membershipProposer);
      mockPrisma.roster.findFirst.mockResolvedValue({ id: receiverRosterId });
      mockPrisma.rosterPlayer.findUnique
        .mockResolvedValueOnce(rpProposer)
        .mockResolvedValueOnce({ ...rpReceiver, rosterId: 'wrong-roster' });

      await expect(service.proposeTrade(leagueId, userId, dto)).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when positions differ', async () => {
      mockPrisma.tradeWindow.findFirst.mockResolvedValue(activeWindow);
      mockPrisma.membership.findUnique.mockResolvedValue(membershipProposer);
      mockPrisma.roster.findFirst.mockResolvedValue({ id: receiverRosterId });
      mockPrisma.rosterPlayer.findUnique
        .mockResolvedValueOnce(rpProposer) // MEI
        .mockResolvedValueOnce({ ...rpReceiver, player: { ...playerMEI_ARG, position: 'GOL' } }); // GOL

      await expect(service.proposeTrade(leagueId, userId, dto)).rejects.toThrow(ConflictException);
    });

    it('creates a trade with 2 items on success', async () => {
      mockPrisma.tradeWindow.findFirst.mockResolvedValue(activeWindow);
      mockPrisma.membership.findUnique.mockResolvedValue(membershipProposer);
      mockPrisma.roster.findFirst.mockResolvedValue({ id: receiverRosterId });
      mockPrisma.rosterPlayer.findUnique
        .mockResolvedValueOnce(rpProposer)
        .mockResolvedValueOnce(rpReceiver);
      mockPrisma.trade.create.mockResolvedValue({ ...pendingTrade, items: pendingTrade.items });
      mockPrisma.player.findMany.mockResolvedValue([playerMEI_BRA, playerMEI_ARG]);

      const result = await service.proposeTrade(leagueId, userId, dto);

      expect(mockPrisma.trade.create).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(TradeStatus.PENDING);
      expect(result.items).toHaveLength(2);
    });
  });

  // ── acceptTrade ─────────────────────────────────────────────────────────────

  describe('acceptTrade', () => {
    const setupAccept = () => {
      mockPrisma.trade.findUnique.mockResolvedValue(pendingTrade);
      mockPrisma.membership.findUnique.mockResolvedValue(membershipReceiver);
      mockPrisma.tradeWindow.findFirst.mockResolvedValue(activeWindow);
    };

    it('throws ForbiddenException when caller is not the receiver', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue(pendingTrade);
      mockPrisma.membership.findUnique.mockResolvedValue(membershipProposer); // proposer calls accept
      await expect(service.acceptTrade(tradeId, userId)).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when trade is not PENDING', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue({
        ...pendingTrade,
        status: TradeStatus.ACCEPTED,
      });
      mockPrisma.membership.findUnique.mockResolvedValue(membershipReceiver);
      await expect(service.acceptTrade(tradeId, userId)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when window is closed', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue(pendingTrade);
      mockPrisma.membership.findUnique.mockResolvedValue(membershipReceiver);
      mockPrisma.tradeWindow.findFirst.mockResolvedValue(null);
      await expect(service.acceptTrade(tradeId, userId)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException (stale) when offered player left proposer roster', async () => {
      setupAccept();
      mockPrisma.$transaction.mockImplementation(
        async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => {
          const tx = {
            ...mockPrisma,
            rosterPlayer: {
              ...mockPrisma.rosterPlayer,
              findUnique: jest
                .fn()
                .mockResolvedValueOnce({ ...rpProposer, rosterId: 'other' }) // stale
                .mockResolvedValueOnce(rpReceiver),
              findFirst: jest.fn().mockResolvedValue(null),
              delete: jest.fn().mockResolvedValue({}),
              create: jest.fn().mockResolvedValue({}),
            },
            trade: {
              ...mockPrisma.trade,
              update: jest
                .fn()
                .mockResolvedValue({ ...pendingTrade, status: TradeStatus.ACCEPTED }),
            },
          };
          return cb(tx);
        },
      );
      await expect(service.acceptTrade(tradeId, userId)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when country conflict for proposer after swap', async () => {
      setupAccept();
      mockPrisma.$transaction.mockImplementation(
        async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => {
          const tx = {
            ...mockPrisma,
            rosterPlayer: {
              ...mockPrisma.rosterPlayer,
              findUnique: jest
                .fn()
                .mockResolvedValueOnce(rpProposer) // offeredRp OK
                .mockResolvedValueOnce(rpReceiver), // requestedRp OK
              findFirst: jest.fn().mockResolvedValueOnce({ id: 'conflict-rp' }), // proposer already has cy player
              delete: jest.fn().mockResolvedValue({}),
              create: jest.fn().mockResolvedValue({}),
            },
            trade: {
              ...mockPrisma.trade,
              update: jest
                .fn()
                .mockResolvedValue({ ...pendingTrade, status: TradeStatus.ACCEPTED }),
            },
          };
          return cb(tx);
        },
      );
      await expect(service.acceptTrade(tradeId, userId)).rejects.toThrow(ConflictException);
    });

    it('swaps players and marks trade ACCEPTED on success', async () => {
      setupAccept();
      const rpUpdateMock = jest.fn().mockResolvedValue({});
      const tradeUpdateMock = jest.fn().mockResolvedValue({
        ...pendingTrade,
        status: TradeStatus.ACCEPTED,
        items: pendingTrade.items,
      });

      mockPrisma.$transaction.mockImplementation(
        async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => {
          const tx = {
            ...mockPrisma,
            rosterPlayer: {
              ...mockPrisma.rosterPlayer,
              findUnique: jest
                .fn()
                .mockResolvedValueOnce(rpProposer)
                .mockResolvedValueOnce(rpReceiver),
              findFirst: jest.fn().mockResolvedValue(null),
              update: rpUpdateMock,
            },
            trade: { ...mockPrisma.trade, update: tradeUpdateMock },
          };
          return cb(tx);
        },
      );

      mockPrisma.player.findUnique
        .mockResolvedValueOnce(playerMEI_BRA)
        .mockResolvedValueOnce(playerMEI_ARG);

      const result = await service.acceptTrade(tradeId, userId);

      expect(rpUpdateMock).toHaveBeenCalledTimes(2);
      expect(result.status).toBe(TradeStatus.ACCEPTED);
    });
  });

  // ── rejectTrade ─────────────────────────────────────────────────────────────

  describe('rejectTrade', () => {
    it('throws ForbiddenException when caller is not the receiver', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue(pendingTrade);
      mockPrisma.membership.findUnique.mockResolvedValue(membershipProposer);
      await expect(service.rejectTrade(tradeId, userId)).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when trade is not PENDING', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue({
        ...pendingTrade,
        status: TradeStatus.ACCEPTED,
      });
      mockPrisma.membership.findUnique.mockResolvedValue(membershipReceiver);
      await expect(service.rejectTrade(tradeId, userId)).rejects.toThrow(ConflictException);
    });

    it('rejects trade successfully', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue(pendingTrade);
      mockPrisma.membership.findUnique.mockResolvedValue(membershipReceiver);
      mockPrisma.trade.update.mockResolvedValue({
        ...pendingTrade,
        status: TradeStatus.REJECTED,
        items: pendingTrade.items,
      });
      mockPrisma.player.findMany.mockResolvedValue([playerMEI_BRA, playerMEI_ARG]);

      const result = await service.rejectTrade(tradeId, userId);
      expect(result.status).toBe(TradeStatus.REJECTED);
    });
  });

  // ── cancelTrade ─────────────────────────────────────────────────────────────

  describe('cancelTrade', () => {
    it('throws ForbiddenException when caller is not the proposer', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue(pendingTrade);
      mockPrisma.membership.findUnique.mockResolvedValue(membershipReceiver);
      await expect(service.cancelTrade(tradeId, otherUserId)).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when trade is not PENDING', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue({
        ...pendingTrade,
        status: TradeStatus.REJECTED,
      });
      mockPrisma.membership.findUnique.mockResolvedValue(membershipProposer);
      await expect(service.cancelTrade(tradeId, userId)).rejects.toThrow(ConflictException);
    });

    it('cancels trade successfully', async () => {
      mockPrisma.trade.findUnique.mockResolvedValue(pendingTrade);
      mockPrisma.membership.findUnique.mockResolvedValue(membershipProposer);
      mockPrisma.trade.update.mockResolvedValue({
        ...pendingTrade,
        status: TradeStatus.CANCELLED,
        items: pendingTrade.items,
      });
      mockPrisma.player.findMany.mockResolvedValue([playerMEI_BRA, playerMEI_ARG]);

      const result = await service.cancelTrade(tradeId, userId);
      expect(result.status).toBe(TradeStatus.CANCELLED);
    });
  });

  // ── signFreeAgent ───────────────────────────────────────────────────────────

  describe('signFreeAgent', () => {
    const dto = { signPlayerId: playerGOL_FRA.id, releasePlayerId: 'p-gol-old' };
    const releaseRp = {
      id: 'rp-gol',
      rosterId: proposerRosterId,
      playerId: 'p-gol-old',
      leagueId,
      countryId: 'ESP',
      player: { position: 'GOL' },
    };

    const makeTx = (
      overrides: {
        signPlayer?: typeof playerGOL_FRA | null;
        existingRp?: { id: string } | null;
        releaseRp?: typeof releaseRp | { rosterId: string; player: { position: string } } | null;
        hasCountry?: { id: string } | null;
      } = {},
    ) => {
      const {
        signPlayer = playerGOL_FRA,
        existingRp = null,
        releaseRp: rp = releaseRp,
        hasCountry = null,
      } = overrides;
      return {
        player: { findUnique: jest.fn().mockResolvedValue(signPlayer) },
        rosterPlayer: {
          findUnique: jest.fn().mockResolvedValueOnce(existingRp).mockResolvedValueOnce(rp),
          findFirst: jest.fn().mockResolvedValue(hasCountry),
          delete: jest.fn().mockResolvedValue({}),
          create: jest.fn().mockResolvedValue({}),
        },
      };
    };

    it('throws ConflictException when no active window', async () => {
      mockPrisma.tradeWindow.findFirst.mockResolvedValue(null);
      await expect(service.signFreeAgent(leagueId, userId, dto)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when signPlayer is already drafted', async () => {
      mockPrisma.tradeWindow.findFirst.mockResolvedValue(activeWindow);
      mockPrisma.membership.findUnique.mockResolvedValue(membershipProposer);
      const tx = makeTx({ existingRp: { id: 'rp-existing' } });
      mockPrisma.$transaction.mockImplementation(
        async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(tx as typeof mockPrisma),
      );
      await expect(service.signFreeAgent(leagueId, userId, dto)).rejects.toThrow(ConflictException);
    });

    it('throws ForbiddenException when releasePlayer is not in user roster', async () => {
      mockPrisma.tradeWindow.findFirst.mockResolvedValue(activeWindow);
      mockPrisma.membership.findUnique.mockResolvedValue(membershipProposer);
      const tx = makeTx({ releaseRp: { ...releaseRp, rosterId: 'other-roster' } });
      mockPrisma.$transaction.mockImplementation(
        async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(tx as typeof mockPrisma),
      );
      await expect(service.signFreeAgent(leagueId, userId, dto)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ConflictException when positions differ', async () => {
      mockPrisma.tradeWindow.findFirst.mockResolvedValue(activeWindow);
      mockPrisma.membership.findUnique.mockResolvedValue(membershipProposer);
      const tx = makeTx({ releaseRp: { ...releaseRp, player: { position: 'MEI' } } });
      mockPrisma.$transaction.mockImplementation(
        async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(tx as typeof mockPrisma),
      );
      await expect(service.signFreeAgent(leagueId, userId, dto)).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when signing would violate country rule', async () => {
      mockPrisma.tradeWindow.findFirst.mockResolvedValue(activeWindow);
      mockPrisma.membership.findUnique.mockResolvedValue(membershipProposer);
      const tx = makeTx({ hasCountry: { id: 'conflict' } });
      mockPrisma.$transaction.mockImplementation(
        async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(tx as typeof mockPrisma),
      );
      await expect(service.signFreeAgent(leagueId, userId, dto)).rejects.toThrow(ConflictException);
    });

    it('executes delete and create inside transaction on success', async () => {
      mockPrisma.tradeWindow.findFirst.mockResolvedValue(activeWindow);
      mockPrisma.membership.findUnique.mockResolvedValue(membershipProposer);
      const tx = makeTx();
      mockPrisma.$transaction.mockImplementation(
        async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(tx as typeof mockPrisma),
      );
      await service.signFreeAgent(leagueId, userId, dto);
      expect(tx.rosterPlayer.delete).toHaveBeenCalledTimes(1);
      expect(tx.rosterPlayer.create).toHaveBeenCalledTimes(1);
    });

    // §7.7 — two concurrent signings of the same free agent → exactly one persists, other gets 409
    it('throws ConflictException (409) when free agent already signed concurrently (P2002)', async () => {
      mockPrisma.tradeWindow.findFirst.mockResolvedValue(activeWindow);
      mockPrisma.membership.findUnique.mockResolvedValue(membershipProposer);
      const p2002 = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
      mockPrisma.$transaction.mockRejectedValue(p2002);
      await expect(service.signFreeAgent(leagueId, userId, dto)).rejects.toThrow(ConflictException);
    });
  });

  // ── listFreeAgents ──────────────────────────────────────────────────────────

  describe('listFreeAgents', () => {
    it('throws NotFoundException when user is not a member', async () => {
      mockPrisma.membership.findUnique.mockResolvedValue(null);
      await expect(service.listFreeAgents(leagueId, userId, {})).rejects.toThrow(NotFoundException);
    });

    it('returns players not in any roster in the league', async () => {
      mockPrisma.membership.findUnique.mockResolvedValue(membershipProposer);
      mockPrisma.player.findMany.mockResolvedValue([{ ...playerGOL_FRA, rosterPlayers: [] }]);

      const result = await service.listFreeAgents(leagueId, userId, {});
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(playerGOL_FRA.id);
    });
  });
});
