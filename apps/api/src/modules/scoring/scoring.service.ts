import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FixturePayload, FixturePlayerStats, FixtureStatus, Position } from '@wcf/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { scorePlayer } from './scoring.engine';
import { RoundScoresResponseDto } from './dto/round-scores-response.dto';

type FixtureEntry = {
  goalsConceded: number;
  playerStatsById: Map<number, FixturePlayerStats>;
};

@Injectable()
export class ScoringService {
  constructor(private readonly prisma: PrismaService) {}

  async scoreRound(leagueId: string, roundId: string, userId: string): Promise<void> {
    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      select: { ownerId: true },
    });
    if (!league) throw new NotFoundException('league not found');
    if (league.ownerId !== userId)
      throw new ForbiddenException('only the owner can trigger scoring');

    const round = await this.prisma.round.findUnique({ where: { id: roundId } });
    if (!round || round.leagueId !== leagueId) throw new NotFoundException('round not found');
    if (!round.locked) throw new ConflictException('round must be locked before scoring');

    const fixtures = await this.prisma.fixtureFacts.findMany({
      where: {
        status: FixtureStatus.FINISHED,
        fixtureRounds: { some: { roundId } },
      },
    });

    const countryMap = this.buildCountryFixtureMap(fixtures);

    const snapshots = await this.prisma.lineupSnapshot.findMany({
      where: { roundId, roster: { membership: { leagueId } } },
      include: {
        slots: {
          where: { isStarter: true },
          include: {
            player: {
              select: { id: true, externalId: true, position: true, countryId: true, name: true },
            },
          },
        },
      },
    });

    await this.prisma.$transaction(async (tx) => {
      for (const snapshot of snapshots) {
        let teamTotal = 0;

        for (const slot of snapshot.slots) {
          const { player } = slot;
          const fixtureEntry = countryMap.get(player.countryId);

          let points = 0;
          let breakdown: Record<string, number> = { subtotal: 0 };

          if (fixtureEntry && player.externalId !== null) {
            const stats = fixtureEntry.playerStatsById.get(player.externalId);
            if (stats) {
              const result = scorePlayer(
                player.position as Position,
                stats,
                fixtureEntry.goalsConceded,
              );
              points = result.points;
              breakdown = result.breakdown;
            }
          }

          const isCaptain = snapshot.captainId === player.id;
          const finalPoints = isCaptain ? points * 2 : points;
          teamTotal += finalPoints;

          await tx.playerRoundScore.upsert({
            where: {
              roundId_rosterId_playerId: {
                roundId,
                rosterId: snapshot.rosterId,
                playerId: player.id,
              },
            },
            create: {
              roundId,
              rosterId: snapshot.rosterId,
              playerId: player.id,
              lineupSnapshotId: snapshot.id,
              points: finalPoints,
              isCaptain,
              breakdown,
            },
            update: { points: finalPoints, isCaptain, breakdown },
          });
        }

        await tx.teamRoundScore.upsert({
          where: { roundId_rosterId: { roundId, rosterId: snapshot.rosterId } },
          create: { roundId, rosterId: snapshot.rosterId, points: teamTotal },
          update: { points: teamTotal },
        });
      }
    });
  }

  async getRoundScores(
    leagueId: string,
    roundId: string,
    userId: string,
  ): Promise<RoundScoresResponseDto> {
    const membership = await this.prisma.membership.findUnique({
      where: { leagueId_userId: { leagueId, userId } },
    });
    if (!membership) throw new NotFoundException('you are not a member of this league');

    const round = await this.prisma.round.findUnique({ where: { id: roundId } });
    if (!round || round.leagueId !== leagueId) throw new NotFoundException('round not found');

    const [teamScores, playerScores] = await Promise.all([
      this.prisma.teamRoundScore.findMany({
        where: { roundId, roster: { membership: { leagueId } } },
        orderBy: { points: 'desc' },
      }),
      this.prisma.playerRoundScore.findMany({
        where: { roundId, roster: { membership: { leagueId } } },
        include: { player: { select: { name: true, position: true } } },
        orderBy: { points: 'desc' },
      }),
    ]);

    const playersByRoster = new Map<string, typeof playerScores>();
    for (const ps of playerScores) {
      const bucket = playersByRoster.get(ps.rosterId) ?? [];
      bucket.push(ps);
      playersByRoster.set(ps.rosterId, bucket);
    }

    return {
      roundId,
      teams: teamScores.map((ts) => ({
        rosterId: ts.rosterId,
        totalPoints: ts.points,
        playerScores: (playersByRoster.get(ts.rosterId) ?? []).map((ps) => ({
          playerId: ps.playerId,
          playerName: ps.player.name,
          position: ps.player.position as Position,
          points: ps.points,
          isCaptain: ps.isCaptain,
          breakdown: ps.breakdown as Record<string, number>,
        })),
      })),
    };
  }

  private buildCountryFixtureMap(
    fixtures: Array<{
      homeCountryId: string | null;
      awayCountryId: string | null;
      payload: Prisma.JsonValue;
      status: string;
    }>,
  ): Map<string, FixtureEntry> {
    const map = new Map<string, FixtureEntry>();

    for (const fixture of fixtures) {
      if (fixture.status !== FixtureStatus.FINISHED) continue;

      const payload = fixture.payload as unknown as FixturePayload;

      if (fixture.homeCountryId) {
        map.set(fixture.homeCountryId, {
          goalsConceded: payload.homeTeam.goalsConceded,
          playerStatsById: new Map(payload.homeTeam.players.map((p) => [p.externalId, p])),
        });
      }

      if (fixture.awayCountryId) {
        map.set(fixture.awayCountryId, {
          goalsConceded: payload.awayTeam.goalsConceded,
          playerStatsById: new Map(payload.awayTeam.players.map((p) => [p.externalId, p])),
        });
      }
    }

    return map;
  }
}
