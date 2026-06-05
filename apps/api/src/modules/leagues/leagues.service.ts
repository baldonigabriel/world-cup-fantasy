import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { DraftStatus } from '@wcf/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateLeagueDto } from './dto/create-league.dto';
import { LeagueMemberDto, LeagueResponseDto } from './dto/league-response.dto';

const leagueInclude = {
  memberships: {
    include: {
      user: { select: { id: true, username: true, teamName: true } },
      roster: { select: { id: true } },
    },
  },
  draftState: { select: { status: true } },
};

@Injectable()
export class LeaguesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateLeagueDto): Promise<LeagueResponseDto> {
    const inviteCode = randomUUID().replace(/-/g, '').toUpperCase().slice(0, 8);

    const league = await this.prisma.$transaction(async (tx) => {
      const created = await tx.league.create({
        data: { name: dto.name, inviteCode, ownerId: userId, maxTeams: dto.maxTeams ?? 8 },
      });
      const membership = await tx.membership.create({
        data: { leagueId: created.id, userId },
      });
      await tx.roster.create({ data: { membershipId: membership.id } });
      return created;
    });

    return this.findById(league.id);
  }

  async join(userId: string, inviteCode: string): Promise<LeagueResponseDto> {
    const league = await this.prisma.league.findUnique({
      where: { inviteCode },
      include: { _count: { select: { memberships: true } }, draftState: true },
    });

    if (!league) throw new NotFoundException('league not found');

    if (league._count.memberships >= league.maxTeams) {
      throw new ConflictException('league is full');
    }

    const existing = await this.prisma.membership.findUnique({
      where: { leagueId_userId: { leagueId: league.id, userId } },
    });
    if (existing) throw new ConflictException('already a member of this league');

    if (league.draftState && league.draftState.status !== DraftStatus.PENDING) {
      throw new ConflictException('draft already started — cannot join');
    }

    await this.prisma.$transaction(async (tx) => {
      const membership = await tx.membership.create({
        data: { leagueId: league.id, userId },
      });
      await tx.roster.create({ data: { membershipId: membership.id } });
    });

    return this.findById(league.id);
  }

  async findByUser(userId: string): Promise<LeagueResponseDto[]> {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      select: { leagueId: true },
    });

    const leagues = await Promise.all(memberships.map((m) => this.findById(m.leagueId)));

    return leagues;
  }

  async findById(leagueId: string): Promise<LeagueResponseDto> {
    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      include: leagueInclude,
    });

    if (!league) throw new NotFoundException('league not found');
    return this.toDto(league);
  }

  async drawDraftOrder(leagueId: string, userId: string): Promise<void> {
    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      include: { memberships: { select: { id: true } }, draftState: true },
    });

    if (!league) throw new NotFoundException('league not found');
    if (league.ownerId !== userId)
      throw new ForbiddenException('only the owner can draw draft order');
    if (league.memberships.length < 2)
      throw new ConflictException('need at least 2 members to draw');

    if (league.draftState && league.draftState.status !== DraftStatus.PENDING) {
      throw new ConflictException('draft already started');
    }

    const order = fisherYates(league.memberships.map((m) => m.id));

    await this.prisma.draftState.upsert({
      where: { leagueId },
      create: { leagueId, order, status: 'PENDING' },
      update: { order },
    });
  }

  private toDto(
    league: Awaited<ReturnType<typeof this.prisma.league.findUnique>> & {
      memberships: {
        id: string;
        user: { id: string; username: string; teamName: string };
        roster: { id: string } | null;
      }[];
      draftState: { status: string } | null;
    },
  ): LeagueResponseDto {
    const members: LeagueMemberDto[] = league!.memberships.map((m) => ({
      membershipId: m.id,
      rosterId: m.roster!.id,
      userId: m.user.id,
      username: m.user.username,
      teamName: m.user.teamName,
    }));

    return {
      id: league!.id,
      name: league!.name,
      inviteCode: league!.inviteCode,
      ownerId: league!.ownerId,
      maxTeams: league!.maxTeams,
      memberCount: members.length,
      draftStatus: (league!.draftState?.status as DraftStatus) ?? null,
      members,
    };
  }
}

function fisherYates<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
