import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DraftStatus } from '@wcf/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { LeaguesService } from './leagues.service';

const userId = 'user-1';

const mockLeague = {
  id: 'league-1',
  name: 'Liga dos Amigos',
  inviteCode: 'ABC12345',
  ownerId: userId,
  maxTeams: 8,
  createdAt: new Date(),
  memberships: [
    {
      id: 'mem-1',
      user: { id: userId, username: 'johndoe', teamName: 'Os Brabos FC' },
      roster: { id: 'roster-1' },
    },
  ],
  draftState: null,
};

const mockPrisma = {
  league: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  membership: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  roster: { create: jest.fn() },
  draftState: { upsert: jest.fn(), findUnique: jest.fn() },
  $transaction: jest.fn(),
};

describe('LeaguesService', () => {
  let service: LeaguesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LeaguesService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get<LeaguesService>(LeaguesService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('creates league with owner as first member', async () => {
      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
      );
      mockPrisma.league.create.mockResolvedValue(mockLeague);
      mockPrisma.membership.create.mockResolvedValue({ id: 'mem-1' });
      mockPrisma.roster.create.mockResolvedValue({ id: 'roster-1' });
      mockPrisma.league.findUnique.mockResolvedValue(mockLeague);

      const result = await service.create(userId, { name: 'Liga dos Amigos' });

      expect(result.name).toBe('Liga dos Amigos');
      expect(result.members).toHaveLength(1);
      expect(mockPrisma.membership.create).toHaveBeenCalled();
      expect(mockPrisma.roster.create).toHaveBeenCalled();
    });
  });

  describe('join', () => {
    it('throws NotFoundException for unknown invite code', async () => {
      mockPrisma.league.findUnique.mockResolvedValue(null);

      await expect(service.join(userId, 'BADCODE1')).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when league is full', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({
        ...mockLeague,
        maxTeams: 1,
        _count: { memberships: 1 },
        draftState: null,
      });

      await expect(service.join('user-2', 'ABC12345')).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when user is already a member', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({
        ...mockLeague,
        _count: { memberships: 1 },
      });
      mockPrisma.membership.findUnique.mockResolvedValue({ id: 'mem-1' });

      await expect(service.join(userId, 'ABC12345')).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when draft already started', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({
        ...mockLeague,
        _count: { memberships: 1 },
        draftState: { status: DraftStatus.IN_PROGRESS },
      });
      mockPrisma.membership.findUnique.mockResolvedValue(null);

      await expect(service.join('user-2', 'ABC12345')).rejects.toThrow(ConflictException);
    });
  });

  describe('drawDraftOrder', () => {
    it('throws ForbiddenException when called by non-owner', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({
        ...mockLeague,
        memberships: [{ id: 'mem-1' }, { id: 'mem-2' }],
        draftState: null,
      });

      await expect(service.drawDraftOrder('league-1', 'other-user')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ConflictException with less than 2 members', async () => {
      mockPrisma.league.findUnique.mockResolvedValue({
        ...mockLeague,
        memberships: [{ id: 'mem-1' }],
        draftState: null,
      });

      await expect(service.drawDraftOrder('league-1', userId)).rejects.toThrow(ConflictException);
    });

    it('generates a valid snake order with all members present', async () => {
      const members = ['mem-1', 'mem-2', 'mem-3', 'mem-4'].map((id) => ({ id }));
      mockPrisma.league.findUnique.mockResolvedValue({
        ...mockLeague,
        memberships: members,
        draftState: null,
      });
      mockPrisma.draftState.upsert.mockResolvedValue({});

      await service.drawDraftOrder('league-1', userId);

      const upsertCall = mockPrisma.draftState.upsert.mock.calls[0][0];
      const order: string[] = upsertCall.create.order;

      expect(order).toHaveLength(4);
      expect(new Set(order).size).toBe(4); // no duplicates
      expect(order.sort()).toEqual(['mem-1', 'mem-2', 'mem-3', 'mem-4'].sort());
    });
  });
});
