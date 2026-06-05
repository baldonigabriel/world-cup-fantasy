import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DraftStatus,
  LINEUP_STARTERS,
  LINEUP_SUBS,
  Position,
  ROSTER_QUOTAS,
  RoundStage,
} from '@wcf/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateRoundDto } from './dto/create-round.dto';
import { RoundResponseDto } from './dto/round-response.dto';
import { UpsertLineupDto } from './dto/upsert-lineup.dto';
import { LineupResponseDto } from './dto/lineup-response.dto';

// Pure function — testable in isolation
export function parseFormation(
  formation: string,
): { def: number; mei: number; ata: number } | null {
  const parts = formation.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n) || n < 0)) return null;
  const [def, mei, ata] = parts;
  if (def + mei + ata !== 10) return null;
  if (def < 1 || def > ROSTER_QUOTAS[Position.DEF]) return null;
  if (mei < 1 || mei > ROSTER_QUOTAS[Position.MEI]) return null;
  if (ata < 1 || ata > ROSTER_QUOTAS[Position.ATA]) return null;
  return { def, mei, ata };
}

const slotPlayerInclude = {
  slots: {
    include: {
      player: {
        select: {
          id: true,
          name: true,
          position: true,
          photoUrl: true,
          country: { select: { code: true } },
        },
      },
    },
  },
} as const;

type SlotPlayer = {
  id: string;
  name: string;
  position: string;
  photoUrl: string | null;
  country: { code: string };
};

type LineupRow = {
  id: string;
  rosterId: string;
  roundId: string;
  formation: string;
  captainId: string;
  updatedAt: Date;
  slots: Array<{ slotIndex: number; isStarter: boolean; player: SlotPlayer }>;
};

@Injectable()
export class LineupService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Rounds ─────────────────────────────────────────────────────────────────

  async createRound(
    leagueId: string,
    userId: string,
    dto: CreateRoundDto,
  ): Promise<RoundResponseDto> {
    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      select: { ownerId: true },
    });
    if (!league) throw new NotFoundException('league not found');
    if (league.ownerId !== userId) throw new ForbiddenException('only the owner can create rounds');

    const round = await this.prisma.round.create({
      data: {
        leagueId,
        stage: dto.stage,
        opensAt: new Date(dto.opensAt),
        lockAt: new Date(dto.lockAt),
      },
    });
    return this.toRoundDto(round);
  }

  async listRounds(leagueId: string): Promise<RoundResponseDto[]> {
    const rounds = await this.prisma.round.findMany({
      where: { leagueId },
      orderBy: { opensAt: 'asc' },
    });
    return rounds.map((r) => this.toRoundDto(r));
  }

  async lockRound(leagueId: string, roundId: string, userId: string): Promise<void> {
    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      select: { ownerId: true },
    });
    if (!league) throw new NotFoundException('league not found');
    if (league.ownerId !== userId) throw new ForbiddenException('only the owner can lock rounds');

    const round = await this.prisma.round.findUnique({
      where: { id: roundId },
      include: {
        lineups: {
          include: { slots: true },
        },
      },
    });
    if (!round || round.leagueId !== leagueId) throw new NotFoundException('round not found');
    if (round.locked) throw new ConflictException('round is already locked');

    await this.prisma.$transaction(async (tx) => {
      for (const lineup of round.lineups) {
        await tx.lineupSnapshot.create({
          data: {
            roundId,
            rosterId: lineup.rosterId,
            captainId: lineup.captainId,
            formation: lineup.formation,
            slots: {
              create: lineup.slots.map((s) => ({
                playerId: s.playerId,
                slotIndex: s.slotIndex,
                isStarter: s.isStarter,
              })),
            },
          },
        });
      }
      await tx.round.update({ where: { id: roundId }, data: { locked: true } });
    });
  }

  // ── Lineup ─────────────────────────────────────────────────────────────────

  async upsertLineup(
    leagueId: string,
    roundId: string,
    userId: string,
    dto: UpsertLineupDto,
  ): Promise<LineupResponseDto> {
    // ── 1. Membership + roster ──────────────────────────────────────────────
    const membership = await this.prisma.membership.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
      include: {
        roster: {
          include: {
            rosterPlayers: { include: { player: { select: { id: true, position: true } } } },
          },
        },
      },
    });
    if (!membership) throw new NotFoundException('you are not a member of this league');

    // ── 2. Draft must be completed ─────────────────────────────────────────
    const draftState = await this.prisma.draftState.findUnique({
      where: { leagueId },
      select: { status: true },
    });
    if (draftState?.status !== DraftStatus.COMPLETED) {
      throw new ConflictException('draft must be completed before setting a lineup');
    }

    // ── 3. Round open ──────────────────────────────────────────────────────
    const round = await this.prisma.round.findUnique({ where: { id: roundId } });
    if (!round || round.leagueId !== leagueId) throw new NotFoundException('round not found');
    if (round.locked) throw new ConflictException('round is locked — lineup cannot be changed');

    // ── 4. Formation ───────────────────────────────────────────────────────
    const formation = parseFormation(dto.formation);
    if (!formation) throw new BadRequestException(`invalid formation "${dto.formation}"`);

    // ── 5. Slot counts ─────────────────────────────────────────────────────
    const starters = dto.slots.filter((s) => s.isStarter);
    const subs = dto.slots.filter((s) => !s.isStarter);
    if (starters.length !== LINEUP_STARTERS) {
      throw new BadRequestException(
        `need exactly ${LINEUP_STARTERS} starters, got ${starters.length}`,
      );
    }
    if (subs.length !== LINEUP_SUBS) {
      throw new BadRequestException(`need exactly ${LINEUP_SUBS} subs, got ${subs.length}`);
    }

    // ── 6. No duplicates ───────────────────────────────────────────────────
    const playerIds = dto.slots.map((s) => s.playerId);
    if (new Set(playerIds).size !== playerIds.length) {
      throw new BadRequestException('duplicate player in slots');
    }
    const slotIndices = dto.slots.map((s) => s.slotIndex);
    if (new Set(slotIndices).size !== slotIndices.length) {
      throw new BadRequestException('duplicate slotIndex in slots');
    }

    // ── 7. All players from roster ─────────────────────────────────────────
    const roster = membership.roster!;
    const rosterMap = new Map(
      roster.rosterPlayers.map((rp) => [rp.player.id, rp.player.position as Position]),
    );
    for (const slot of dto.slots) {
      if (!rosterMap.has(slot.playerId)) {
        throw new BadRequestException(`player ${slot.playerId} is not in your roster`);
      }
    }

    // ── 8. Exactly 1 GOL starter ───────────────────────────────────────────
    const starterPositions = starters.map((s) => rosterMap.get(s.playerId)!);
    const golCount = starterPositions.filter((p) => p === Position.GOL).length;
    if (golCount !== 1) {
      throw new BadRequestException(`need exactly 1 GOL starter, got ${golCount}`);
    }

    // ── 9. Formation matches starter breakdown ─────────────────────────────
    const defCount = starterPositions.filter((p) => p === Position.DEF).length;
    const meiCount = starterPositions.filter((p) => p === Position.MEI).length;
    const ataCount = starterPositions.filter((p) => p === Position.ATA).length;
    if (defCount !== formation.def || meiCount !== formation.mei || ataCount !== formation.ata) {
      throw new BadRequestException(
        `starter positions (${defCount}-${meiCount}-${ataCount}) do not match formation ${dto.formation}`,
      );
    }

    // ── 10. Captain is a starter ───────────────────────────────────────────
    if (!starters.some((s) => s.playerId === dto.captainId)) {
      throw new BadRequestException('captain must be a starter');
    }

    // ── 11. Upsert ─────────────────────────────────────────────────────────
    const slotData = dto.slots.map((s) => ({
      playerId: s.playerId,
      slotIndex: s.slotIndex,
      isStarter: s.isStarter,
    }));

    const lineup = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.lineup.findUnique({
        where: { rosterId_roundId: { rosterId: roster.id, roundId } },
      });

      if (existing) {
        return tx.lineup.update({
          where: { id: existing.id },
          data: {
            formation: dto.formation,
            captainId: dto.captainId,
            slots: { deleteMany: {}, create: slotData },
          },
          include: slotPlayerInclude,
        });
      }

      return tx.lineup.create({
        data: {
          rosterId: roster.id,
          roundId,
          formation: dto.formation,
          captainId: dto.captainId,
          slots: { create: slotData },
        },
        include: slotPlayerInclude,
      });
    });

    return this.toLineupDto(lineup as LineupRow);
  }

  async getMyLineup(leagueId: string, roundId: string, userId: string): Promise<LineupResponseDto> {
    const membership = await this.prisma.membership.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
      include: { roster: { select: { id: true } } },
    });
    if (!membership) throw new NotFoundException('you are not a member of this league');

    const lineup = await this.prisma.lineup.findUnique({
      where: { rosterId_roundId: { rosterId: membership.roster!.id, roundId } },
      include: slotPlayerInclude,
    });
    if (!lineup) throw new NotFoundException('no lineup found for this round');

    return this.toLineupDto(lineup as LineupRow);
  }

  async getAllLineups(
    leagueId: string,
    roundId: string,
    userId: string,
  ): Promise<LineupResponseDto[]> {
    const membership = await this.prisma.membership.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
    });
    if (!membership) throw new NotFoundException('you are not a member of this league');

    const lineups = await this.prisma.lineup.findMany({
      where: { roundId, roster: { membership: { leagueId } } },
      include: slotPlayerInclude,
    });

    return (lineups as LineupRow[]).map((l) => this.toLineupDto(l));
  }

  // ── Mappers ────────────────────────────────────────────────────────────────

  private toRoundDto(round: {
    id: string;
    stage: string;
    opensAt: Date;
    lockAt: Date;
    locked: boolean;
  }): RoundResponseDto {
    return {
      id: round.id,
      stage: round.stage as RoundStage,
      opensAt: round.opensAt.toISOString(),
      lockAt: round.lockAt.toISOString(),
      locked: round.locked,
    };
  }

  private toLineupDto(lineup: LineupRow): LineupResponseDto {
    return {
      id: lineup.id,
      rosterId: lineup.rosterId,
      roundId: lineup.roundId,
      formation: lineup.formation,
      captainId: lineup.captainId,
      updatedAt: lineup.updatedAt.toISOString(),
      slots: lineup.slots.map((s) => ({
        slotIndex: s.slotIndex,
        isStarter: s.isStarter,
        player: {
          id: s.player.id,
          name: s.player.name,
          position: s.player.position as Position,
          photoUrl: s.player.photoUrl,
          countryCode: s.player.country.code,
        },
      })),
    };
  }
}
