import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Prisma } from '@prisma/client';
import { Position, TradeStatus } from '@wcf/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTradeWindowDto } from './dto/create-trade-window.dto';
import { FreeAgentFilterDto } from './dto/free-agent-filter.dto';
import { ProposeTradeDto } from './dto/propose-trade.dto';
import { SignFreeAgentDto } from './dto/sign-free-agent.dto';
import { FreeAgentResponseDto, TradeResponseDto } from './dto/trade-response.dto';
import { TradeWindowResponseDto } from './dto/trade-window-response.dto';

const PLAYER_INCLUDE = {
  include: { country: { select: { code: true, name: true } } },
} as const;

@Injectable()
export class TradesService {
  private readonly logger = new Logger(TradesService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ── Scheduler ─────────────────────────────────────────────────────────────────

  @Cron(CronExpression.EVERY_HOUR)
  async expirePendingTrades(): Promise<void> {
    const now = new Date();
    const { count } = await this.prisma.trade.updateMany({
      where: {
        status: TradeStatus.PENDING,
        tradeWindow: { closesAt: { lt: now } },
      },
      data: { status: TradeStatus.EXPIRED },
    });
    if (count > 0) {
      this.logger.log(`Expired ${count} pending trade(s) from closed windows`);
    }
  }

  // ── Trade Windows ─────────────────────────────────────────────────────────────

  async createTradeWindow(
    leagueId: string,
    userId: string,
    dto: CreateTradeWindowDto,
  ): Promise<TradeWindowResponseDto> {
    const league = await this.prisma.league.findUnique({ where: { id: leagueId } });
    if (!league) throw new NotFoundException('league not found');
    if (league.ownerId !== userId)
      throw new ForbiddenException('only the league owner can create trade windows');

    const opens = new Date(dto.opensAt);
    const closes = new Date(dto.closesAt);
    if (closes <= opens) throw new BadRequestException('closesAt must be after opensAt');

    const window = await this.prisma.tradeWindow.create({
      data: { leagueId, opensAt: opens, closesAt: closes },
    });

    return this.mapWindow(window);
  }

  async listTradeWindows(leagueId: string, userId: string): Promise<TradeWindowResponseDto[]> {
    await this.assertMember(leagueId, userId);
    const windows = await this.prisma.tradeWindow.findMany({
      where: { leagueId },
      orderBy: { opensAt: 'desc' },
    });
    return windows.map((w) => this.mapWindow(w));
  }

  // ── Trades ────────────────────────────────────────────────────────────────────

  async proposeTrade(
    leagueId: string,
    userId: string,
    dto: ProposeTradeDto,
  ): Promise<TradeResponseDto> {
    const activeWindow = await this.findActiveWindow(leagueId);
    if (!activeWindow) throw new ConflictException('no active trade window');
    await this.assertNoLockedRound(leagueId);

    const membership = await this.assertMember(leagueId, userId);
    const proposerRosterId = membership.roster!.id;

    if (dto.receiverRosterId === proposerRosterId) {
      throw new BadRequestException('cannot trade with yourself');
    }

    // Verify receiver belongs to the same league
    const receiverRoster = await this.prisma.roster.findFirst({
      where: { id: dto.receiverRosterId, membership: { leagueId } },
    });
    if (!receiverRoster) throw new NotFoundException('receiver team not found in this league');

    const offeredRp = await this.prisma.rosterPlayer.findUnique({
      where: { leagueId_playerId: { leagueId, playerId: dto.offeredPlayerId } },
      include: { player: PLAYER_INCLUDE },
    });
    if (!offeredRp || offeredRp.rosterId !== proposerRosterId) {
      throw new ForbiddenException('offered player is not in your roster');
    }

    const requestedRp = await this.prisma.rosterPlayer.findUnique({
      where: { leagueId_playerId: { leagueId, playerId: dto.requestedPlayerId } },
      include: { player: PLAYER_INCLUDE },
    });
    if (!requestedRp || requestedRp.rosterId !== dto.receiverRosterId) {
      throw new ForbiddenException('requested player is not in the receiver roster');
    }

    if (offeredRp.player.position !== requestedRp.player.position) {
      throw new ConflictException('players must share the same position');
    }

    const trade = await this.prisma.trade.create({
      data: {
        leagueId,
        tradeWindowId: activeWindow.id,
        proposerRosterId,
        receiverRosterId: dto.receiverRosterId,
        status: TradeStatus.PENDING,
        items: {
          create: [
            {
              playerId: dto.offeredPlayerId,
              fromRosterId: proposerRosterId,
              toRosterId: dto.receiverRosterId,
            },
            {
              playerId: dto.requestedPlayerId,
              fromRosterId: dto.receiverRosterId,
              toRosterId: proposerRosterId,
            },
          ],
        },
      },
      include: { items: { include: { trade: false } } },
    });

    this.logger.log(`Trade proposed: ${trade.id}`);
    return this.mapTrade(trade, offeredRp.player, requestedRp.player);
  }

  async acceptTrade(tradeId: string, userId: string): Promise<TradeResponseDto> {
    const trade = await this.loadTrade(tradeId);
    const leagueId = trade.leagueId;

    const membership = await this.assertMember(leagueId, userId);
    const userRosterId = membership.roster!.id;

    if (trade.receiverRosterId !== userRosterId) {
      throw new ForbiddenException('only the receiver can accept a trade');
    }
    if (trade.status !== TradeStatus.PENDING) {
      throw new ConflictException(`trade is already ${trade.status.toLowerCase()}`);
    }

    const activeWindow = await this.findActiveWindow(leagueId);
    if (!activeWindow) throw new ConflictException('trade window is no longer open');
    await this.assertNoLockedRound(leagueId);

    const offeredItem = trade.items.find((i) => i.fromRosterId === trade.proposerRosterId)!;
    const requestedItem = trade.items.find((i) => i.fromRosterId === trade.receiverRosterId)!;

    const updatedTrade = await this.prisma.$transaction(async (tx) => {
      // Revalidate stale state inside transaction
      const offeredRp = await tx.rosterPlayer.findUnique({
        where: { leagueId_playerId: { leagueId, playerId: offeredItem.playerId } },
        include: { player: { select: { position: true, countryId: true } } },
      });
      if (!offeredRp || offeredRp.rosterId !== trade.proposerRosterId) {
        throw new ConflictException('stale trade: offered player is no longer in proposer roster');
      }

      const requestedRp = await tx.rosterPlayer.findUnique({
        where: { leagueId_playerId: { leagueId, playerId: requestedItem.playerId } },
        include: { player: { select: { position: true, countryId: true } } },
      });
      if (!requestedRp || requestedRp.rosterId !== trade.receiverRosterId) {
        throw new ConflictException(
          'stale trade: requested player is no longer in receiver roster',
        );
      }

      if (offeredRp.player.position !== requestedRp.player.position) {
        throw new ConflictException('players no longer share the same position');
      }

      // Country conflict checks (skip when same country — both rosters maintain count)
      const cx = offeredRp.player.countryId;
      const cy = requestedRp.player.countryId;

      if (cx !== cy) {
        // Proposer gains cy — check proposer doesn't already have another cy player
        const proposerHasCy = await tx.rosterPlayer.findFirst({
          where: {
            rosterId: trade.proposerRosterId,
            countryId: cy,
            playerId: { not: offeredItem.playerId },
          },
        });
        if (proposerHasCy)
          throw new ConflictException(
            'country conflict: your team already has a player from that country',
          );

        // Receiver gains cx — check receiver doesn't already have another cx player
        const receiverHasCx = await tx.rosterPlayer.findFirst({
          where: {
            rosterId: trade.receiverRosterId,
            countryId: cx,
            playerId: { not: requestedItem.playerId },
          },
        });
        if (receiverHasCx)
          throw new ConflictException(
            'country conflict: receiver team already has a player from that country',
          );
      }

      // Atomic swap: update rosterId directly — avoids transitional constraint violations
      await tx.rosterPlayer.update({
        where: { leagueId_playerId: { leagueId, playerId: offeredItem.playerId } },
        data: { rosterId: trade.receiverRosterId },
      });
      await tx.rosterPlayer.update({
        where: { leagueId_playerId: { leagueId, playerId: requestedItem.playerId } },
        data: { rosterId: trade.proposerRosterId },
      });

      return tx.trade.update({
        where: { id: tradeId },
        data: { status: TradeStatus.ACCEPTED },
        include: { items: true },
      });
    });

    this.logger.log(`Trade accepted: ${tradeId}`);

    const offeredPlayer = await this.prisma.player.findUnique({
      where: { id: offeredItem.playerId },
      ...PLAYER_INCLUDE,
    });
    const requestedPlayer = await this.prisma.player.findUnique({
      where: { id: requestedItem.playerId },
      ...PLAYER_INCLUDE,
    });

    return this.mapTrade(updatedTrade, offeredPlayer!, requestedPlayer!);
  }

  async rejectTrade(tradeId: string, userId: string): Promise<TradeResponseDto> {
    const trade = await this.loadTrade(tradeId);

    const membership = await this.assertMember(trade.leagueId, userId);
    if (trade.receiverRosterId !== membership.roster!.id) {
      throw new ForbiddenException('only the receiver can reject a trade');
    }
    if (trade.status !== TradeStatus.PENDING) {
      throw new ConflictException(`trade is already ${trade.status.toLowerCase()}`);
    }

    const updated = await this.prisma.trade.update({
      where: { id: tradeId },
      data: { status: TradeStatus.REJECTED },
      include: { items: true },
    });

    return this.mapTradeWithItems(updated);
  }

  async cancelTrade(tradeId: string, userId: string): Promise<TradeResponseDto> {
    const trade = await this.loadTrade(tradeId);

    const membership = await this.assertMember(trade.leagueId, userId);
    if (trade.proposerRosterId !== membership.roster!.id) {
      throw new ForbiddenException('only the proposer can cancel a trade');
    }
    if (trade.status !== TradeStatus.PENDING) {
      throw new ConflictException(`trade is already ${trade.status.toLowerCase()}`);
    }

    const updated = await this.prisma.trade.update({
      where: { id: tradeId },
      data: { status: TradeStatus.CANCELLED },
      include: { items: true },
    });

    return this.mapTradeWithItems(updated);
  }

  async listTrades(leagueId: string, userId: string): Promise<TradeResponseDto[]> {
    const membership = await this.assertMember(leagueId, userId);
    const rosterId = membership.roster!.id;

    const trades = await this.prisma.trade.findMany({
      where: {
        leagueId,
        OR: [{ proposerRosterId: rosterId }, { receiverRosterId: rosterId }],
      },
      include: {
        items: {
          include: {
            trade: false,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(trades.map((t) => this.mapTradeWithItems(t)));
  }

  // ── Signings ──────────────────────────────────────────────────────────────────

  async signFreeAgent(leagueId: string, userId: string, dto: SignFreeAgentDto): Promise<void> {
    const activeWindow = await this.findActiveWindow(leagueId);
    if (!activeWindow) throw new ConflictException('no active trade window');
    await this.assertNoLockedRound(leagueId);

    const membership = await this.assertMember(leagueId, userId);
    const rosterId = membership.roster!.id;

    try {
      await this.prisma.$transaction(
        async (tx) => {
          const signPlayer = await tx.player.findUnique({
            where: { id: dto.signPlayerId },
            include: { country: true },
          });
          if (!signPlayer) throw new NotFoundException('player not found');

          const existingRp = await tx.rosterPlayer.findUnique({
            where: { leagueId_playerId: { leagueId, playerId: dto.signPlayerId } },
          });
          if (existingRp) throw new ConflictException('player is not a free agent in this league');

          const releaseRp = await tx.rosterPlayer.findUnique({
            where: { leagueId_playerId: { leagueId, playerId: dto.releasePlayerId } },
            include: { player: { select: { position: true } } },
          });
          if (!releaseRp || releaseRp.rosterId !== rosterId) {
            throw new ForbiddenException('released player is not in your roster');
          }

          if (signPlayer.position !== releaseRp.player.position) {
            throw new ConflictException('signed and released players must share the same position');
          }

          const hasCountry = await tx.rosterPlayer.findFirst({
            where: {
              rosterId,
              countryId: signPlayer.countryId,
              playerId: { not: dto.releasePlayerId },
            },
          });
          if (hasCountry)
            throw new ConflictException('your team already has a player from that country');

          await tx.rosterPlayer.delete({
            where: { leagueId_playerId: { leagueId, playerId: dto.releasePlayerId } },
          });
          await tx.rosterPlayer.create({
            data: {
              rosterId,
              playerId: dto.signPlayerId,
              leagueId,
              countryId: signPlayer.countryId,
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2002') {
        throw new ConflictException('free agent already signed by another team');
      }
      throw e;
    }

    this.logger.log(
      `Signing: roster ${rosterId} signed ${dto.signPlayerId}, released ${dto.releasePlayerId}`,
    );
  }

  async listFreeAgents(
    leagueId: string,
    userId: string,
    filter: FreeAgentFilterDto,
  ): Promise<FreeAgentResponseDto[]> {
    await this.assertMember(leagueId, userId);

    const players = await this.prisma.player.findMany({
      where: {
        rosterPlayers: { none: { leagueId } },
        ...(filter.position ? { position: filter.position as Position } : {}),
        ...(filter.countryCode ? { country: { code: filter.countryCode.toUpperCase() } } : {}),
      },
      include: { country: true },
      orderBy: { name: 'asc' },
      take: 100,
    });

    return players.map((p) => ({
      id: p.id,
      name: p.name,
      position: p.position as Position,
      countryCode: p.country.code,
      countryName: p.country.name,
      photoUrl: p.photoUrl,
    }));
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private async assertMember(leagueId: string, userId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
      include: { roster: { select: { id: true } } },
    });
    if (!membership) throw new NotFoundException('you are not a member of this league');
    return membership;
  }

  private async findActiveWindow(leagueId: string) {
    const now = new Date();
    return this.prisma.tradeWindow.findFirst({
      where: {
        leagueId,
        opensAt: { lte: now },
        closesAt: { gte: now },
      },
    });
  }

  private async assertNoLockedRound(leagueId: string): Promise<void> {
    const lockedRound = await this.prisma.round.findFirst({
      where: { leagueId, locked: true },
    });
    if (lockedRound) {
      throw new ConflictException('Trades are locked during an active round');
    }
  }

  private async loadTrade(tradeId: string) {
    const trade = await this.prisma.trade.findUnique({
      where: { id: tradeId },
      include: { items: true },
    });
    if (!trade) throw new NotFoundException('trade not found');
    return trade;
  }

  private mapWindow(w: {
    id: string;
    leagueId: string;
    opensAt: Date;
    closesAt: Date;
  }): TradeWindowResponseDto {
    const now = new Date();
    return {
      id: w.id,
      leagueId: w.leagueId,
      opensAt: w.opensAt.toISOString(),
      closesAt: w.closesAt.toISOString(),
      isOpen: w.opensAt <= now && now <= w.closesAt,
    };
  }

  private mapTrade(
    trade: {
      id: string;
      leagueId: string;
      status: string;
      proposerRosterId: string;
      receiverRosterId: string;
      tradeWindowId: string | null;
      createdAt: Date;
      items: { playerId: string; fromRosterId: string; toRosterId: string }[];
    },
    offeredPlayer: { id: string; name: string; position: string; country: { code: string } },
    requestedPlayer: { id: string; name: string; position: string; country: { code: string } },
  ): TradeResponseDto {
    return {
      id: trade.id,
      leagueId: trade.leagueId,
      status: trade.status as TradeStatus,
      proposerRosterId: trade.proposerRosterId,
      receiverRosterId: trade.receiverRosterId,
      tradeWindowId: trade.tradeWindowId,
      createdAt: trade.createdAt.toISOString(),
      items: trade.items.map((item) => {
        const player =
          item.fromRosterId === trade.proposerRosterId ? offeredPlayer : requestedPlayer;
        return {
          playerId: item.playerId,
          fromRosterId: item.fromRosterId,
          toRosterId: item.toRosterId,
          player: {
            id: player.id,
            name: player.name,
            position: player.position as import('@wcf/shared').Position,
            countryCode: player.country.code,
          },
        };
      }),
    };
  }

  private async mapTradeWithItems(trade: {
    id: string;
    leagueId: string;
    status: string;
    proposerRosterId: string;
    receiverRosterId: string;
    tradeWindowId: string | null;
    createdAt: Date;
    items: { playerId: string; fromRosterId: string; toRosterId: string }[];
  }): Promise<TradeResponseDto> {
    const playerIds = trade.items.map((i) => i.playerId);
    const players = await this.prisma.player.findMany({
      where: { id: { in: playerIds } },
      include: { country: { select: { code: true } } },
    });
    const playerMap = new Map(players.map((p) => [p.id, p]));

    return {
      id: trade.id,
      leagueId: trade.leagueId,
      status: trade.status as TradeStatus,
      proposerRosterId: trade.proposerRosterId,
      receiverRosterId: trade.receiverRosterId,
      tradeWindowId: trade.tradeWindowId,
      createdAt: trade.createdAt.toISOString(),
      items: trade.items.map((item) => {
        const p = playerMap.get(item.playerId)!;
        return {
          playerId: item.playerId,
          fromRosterId: item.fromRosterId,
          toRosterId: item.toRosterId,
          player: {
            id: p.id,
            name: p.name,
            position: p.position as import('@wcf/shared').Position,
            countryCode: p.country.code,
          },
        };
      }),
    };
  }
}
