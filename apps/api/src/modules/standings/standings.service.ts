import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StandingEntryResponseDto } from './dto/standing-entry-response.dto';

@Injectable()
export class StandingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStandings(leagueId: string, userId: string): Promise<StandingEntryResponseDto[]> {
    await this.assertMember(leagueId, userId);

    const [memberships, teamScores] = await Promise.all([
      this.prisma.membership.findMany({
        where: { leagueId },
        include: {
          roster: { select: { id: true } },
          user: { select: { username: true, teamName: true } },
        },
      }),
      this.prisma.teamRoundScore.findMany({
        where: { roster: { membership: { leagueId } } },
      }),
    ]);

    const byRoster = new Map(
      memberships.map((m) => [
        m.roster!.id,
        {
          rosterId: m.roster!.id,
          teamName: m.user.teamName,
          username: m.user.username,
          totalPoints: 0,
          roundPoints: {} as Record<string, number>,
        },
      ]),
    );

    for (const ts of teamScores) {
      const entry = byRoster.get(ts.rosterId);
      if (entry) {
        entry.totalPoints += ts.points;
        entry.roundPoints[ts.roundId] = ts.points;
      }
    }

    return this.rankEntries(Array.from(byRoster.values()));
  }

  async getRoundStandings(
    leagueId: string,
    roundId: string,
    userId: string,
  ): Promise<StandingEntryResponseDto[]> {
    await this.assertMember(leagueId, userId);

    const round = await this.prisma.round.findUnique({ where: { id: roundId } });
    if (!round || round.leagueId !== leagueId) throw new NotFoundException('round not found');

    const [memberships, roundScores] = await Promise.all([
      this.prisma.membership.findMany({
        where: { leagueId },
        include: {
          roster: { select: { id: true } },
          user: { select: { username: true, teamName: true } },
        },
      }),
      this.prisma.teamRoundScore.findMany({
        where: { roundId, roster: { membership: { leagueId } } },
      }),
    ]);

    const scoreByRoster = new Map(roundScores.map((s) => [s.rosterId, s.points]));

    const entries = memberships.map((m) => {
      const pts = scoreByRoster.get(m.roster!.id) ?? 0;
      return {
        rosterId: m.roster!.id,
        teamName: m.user.teamName,
        username: m.user.username,
        totalPoints: pts,
        roundPoints: pts > 0 ? { [roundId]: pts } : {},
      };
    });

    return this.rankEntries(entries);
  }

  private async assertMember(leagueId: string, userId: string): Promise<void> {
    const membership = await this.prisma.membership.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
    });
    if (!membership) throw new NotFoundException('you are not a member of this league');
  }

  private rankEntries(
    entries: Omit<StandingEntryResponseDto, 'rank'>[],
  ): StandingEntryResponseDto[] {
    const sorted = [...entries].sort((a, b) => b.totalPoints - a.totalPoints);

    let rank = 1;
    return sorted.map((entry, i) => {
      if (i > 0 && sorted[i].totalPoints < sorted[i - 1].totalPoints) {
        rank = i + 1;
      }
      return { ...entry, rank };
    });
  }
}
