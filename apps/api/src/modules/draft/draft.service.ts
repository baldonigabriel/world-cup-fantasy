import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DraftStatus, Position, ROSTER_QUOTAS, ROSTER_SIZE } from '@wcf/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { DraftStateResponseDto } from './dto/draft-state-response.dto';

// Pure function — testable in isolation
export function resolvePickingMembership(pickIndex: number, order: string[]): string {
  const n = order.length;
  const round = Math.floor(pickIndex / n);
  const posInRound = pickIndex % n;
  const teamIndex = round % 2 === 0 ? posInRound : n - 1 - posInRound;
  return order[teamIndex];
}

interface TxClient {
  player: {
    count: (args: { where: Prisma.PlayerWhereInput }) => Promise<number>;
  };
}

@Injectable()
export class DraftService {
  constructor(private readonly prisma: PrismaService) {}

  async startDraft(leagueId: string, userId: string): Promise<void> {
    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      select: { ownerId: true },
    });
    if (!league) throw new NotFoundException('league not found');
    if (league.ownerId !== userId)
      throw new ForbiddenException('only the owner can start the draft');

    const draftState = await this.prisma.draftState.findUnique({ where: { leagueId } });
    if (!draftState || draftState.order.length === 0) {
      throw new ConflictException('draw the draft order before starting');
    }
    if (draftState.status !== DraftStatus.PENDING) {
      throw new ConflictException('draft is not in pending state');
    }

    await this.prisma.draftState.update({
      where: { leagueId },
      data: { status: DraftStatus.IN_PROGRESS },
    });
  }

  async pick(leagueId: string, userId: string, playerId: string): Promise<DraftStateResponseDto> {
    await this.prisma.$transaction(
      async (tx) => {
        // ── 1. Load and validate draft state ──────────────────────────────
        const draftState = await tx.draftState.findUnique({ where: { leagueId } });
        if (!draftState) throw new NotFoundException('draft not found');
        if (draftState.status !== DraftStatus.IN_PROGRESS) {
          throw new ConflictException('draft is not in progress');
        }

        // ── 2. Verify it is the user's turn ───────────────────────────────
        const expectedMembId = resolvePickingMembership(draftState.currentPick, draftState.order);
        const membership = await tx.membership.findUnique({
          where: { leagueId_userId: { leagueId, userId } },
          include: {
            roster: {
              include: {
                rosterPlayers: { include: { player: { select: { position: true } } } },
              },
            },
          },
        });
        if (!membership) throw new NotFoundException('you are not a member of this league');
        if (membership.id !== expectedMembId) throw new ConflictException('not your turn');

        // ── 3. Load player ────────────────────────────────────────────────
        const player = await tx.player.findUnique({
          where: { id: playerId },
          include: { country: { select: { name: true } } },
        });
        if (!player) throw new NotFoundException('player not found');

        const roster = membership.roster!;
        const rosterPlayers = roster.rosterPlayers;

        // ── Rule 1: available? ─────────────────────────────────────────────
        const alreadyDrafted = await tx.rosterPlayer.findUnique({
          where: { leagueId_playerId: { leagueId, playerId } },
        });
        if (alreadyDrafted) throw new ConflictException('player already drafted in this league');

        // ── Rule 3: quota not exceeded? ────────────────────────────────────
        const positionCount = rosterPlayers.filter(
          (rp) => rp.player.position === player.position,
        ).length;
        const quota = ROSTER_QUOTAS[player.position as Position];
        if (positionCount >= quota) {
          throw new ConflictException(
            `${player.position} quota (${quota}) already full for your team`,
          );
        }

        // ── Rule 4: country unique in team? ────────────────────────────────
        const countryConflict = rosterPlayers.some((rp) => rp.countryId === player.countryId);
        if (countryConflict) {
          throw new ConflictException(`you already have a player from ${player.country.name}`);
        }

        // ── Rule 5: roster still completable after this pick? ─────────────
        await this.assertCompletable(
          tx,
          leagueId,
          rosterPlayers,
          player.countryId,
          player.position as Position,
        );

        // ── Execute pick atomically ────────────────────────────────────────
        await tx.rosterPlayer.create({
          data: { rosterId: roster.id, playerId, leagueId, countryId: player.countryId },
        });

        await tx.draftPick.create({
          data: {
            draftStateId: draftState.id,
            membershipId: membership.id,
            playerId,
            pickIndex: draftState.currentPick,
          },
        });

        const newPickIndex = draftState.currentPick + 1;
        const totalPicks = draftState.order.length * ROSTER_SIZE;
        const newStatus =
          newPickIndex >= totalPicks ? DraftStatus.COMPLETED : DraftStatus.IN_PROGRESS;

        await tx.draftState.update({
          where: { leagueId },
          data: { currentPick: newPickIndex, status: newStatus },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.getState(leagueId);
  }

  async getState(leagueId: string): Promise<DraftStateResponseDto> {
    const draftState = await this.prisma.draftState.findUnique({
      where: { leagueId },
      include: {
        picks: {
          include: { player: { include: { country: true } } },
          orderBy: { pickIndex: 'asc' },
        },
      },
    });

    if (!draftState) throw new NotFoundException('draft not found');

    const totalPicks = draftState.order.length * ROSTER_SIZE;
    const nextMembershipId =
      draftState.status === DraftStatus.IN_PROGRESS
        ? resolvePickingMembership(draftState.currentPick, draftState.order)
        : null;

    return {
      status: draftState.status as DraftStatus,
      currentPick: draftState.currentPick,
      totalPicks,
      nextMembershipId,
      order: draftState.order,
      picks: draftState.picks.map((p) => ({
        pickIndex: p.pickIndex,
        membershipId: p.membershipId,
        pickedAt: p.pickedAt.toISOString(),
        player: {
          id: p.player.id,
          name: p.player.name,
          position: p.player.position as Position,
          photoUrl: p.player.photoUrl,
          countryName: p.player.country.name,
          countryCode: p.player.country.code,
        },
      })),
    };
  }

  private async assertCompletable(
    tx: TxClient,
    leagueId: string,
    currentRosterPlayers: { countryId: string; player: { position: string } }[],
    newCountryId: string,
    newPosition: Position,
  ): Promise<void> {
    const usedCountries = new Set([
      ...currentRosterPlayers.map((rp) => rp.countryId),
      newCountryId,
    ]);

    const positionCounts: Record<Position, number> = {
      [Position.GOL]: 0,
      [Position.DEF]: 0,
      [Position.MEI]: 0,
      [Position.ATA]: 0,
    };
    for (const rp of currentRosterPlayers) {
      positionCounts[rp.player.position as Position]++;
    }
    positionCounts[newPosition]++;

    for (const position of Object.values(Position)) {
      const remaining = ROSTER_QUOTAS[position] - positionCounts[position];
      if (remaining <= 0) continue;

      const available = await tx.player.count({
        where: {
          position,
          rosterPlayers: { none: { leagueId } },
          countryId: { notIn: Array.from(usedCountries) },
        },
      });

      if (available < remaining) {
        throw new ConflictException(
          `pick would make it impossible to complete ${position} slots (need ${remaining}, only ${available} available)`,
        );
      }
    }
  }
}
