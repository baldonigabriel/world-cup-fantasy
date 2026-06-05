import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { FixtureStatus } from '@wcf/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { IngestFixtureDto } from './dto/ingest-fixture.dto';
import { FixtureResponseDto } from './dto/fixture-response.dto';

@Injectable()
export class MatchesService {
  constructor(private readonly prisma: PrismaService) {}

  async ingestFixture(dto: IngestFixtureDto): Promise<FixtureResponseDto> {
    const [homeCountry, awayCountry] = await Promise.all([
      this.prisma.country.findUnique({
        where: { code: dto.homeTeam.countryCode },
        select: { id: true, code: true },
      }),
      this.prisma.country.findUnique({
        where: { code: dto.awayTeam.countryCode },
        select: { id: true, code: true },
      }),
    ]);

    if (!homeCountry) throw new NotFoundException(`country not found: ${dto.homeTeam.countryCode}`);
    if (!awayCountry) throw new NotFoundException(`country not found: ${dto.awayTeam.countryCode}`);

    const payload: Prisma.InputJsonValue = {
      homeTeam: {
        countryCode: dto.homeTeam.countryCode,
        goalsConceded: dto.homeTeam.goalsConceded,
        players: dto.homeTeam.players.map((p) => ({ ...p })),
      },
      awayTeam: {
        countryCode: dto.awayTeam.countryCode,
        goalsConceded: dto.awayTeam.goalsConceded,
        players: dto.awayTeam.players.map((p) => ({ ...p })),
      },
    };

    const fixture = await this.prisma.$transaction(async (tx) => {
      const result = await tx.fixtureFacts.upsert({
        where: { fixtureId: dto.fixtureId },
        create: {
          fixtureId: dto.fixtureId,
          status: dto.status,
          homeCountryId: homeCountry.id,
          awayCountryId: awayCountry.id,
          payload,
        },
        update: {
          status: dto.status,
          homeCountryId: homeCountry.id,
          awayCountryId: awayCountry.id,
          payload,
          updatedAt: new Date(),
        },
      });

      if (dto.roundId) {
        await tx.fixtureRound.upsert({
          where: { fixtureId_roundId: { fixtureId: dto.fixtureId, roundId: dto.roundId } },
          create: { fixtureId: dto.fixtureId, roundId: dto.roundId },
          update: {},
        });
      }

      return result;
    });

    return {
      fixtureId: fixture.fixtureId,
      status: fixture.status as FixtureStatus,
      homeCountryCode: homeCountry.code,
      awayCountryCode: awayCountry.code,
      fetchedAt: fixture.fetchedAt.toISOString(),
    };
  }

  async linkToRound(
    leagueId: string,
    roundId: string,
    fixtureId: number,
    userId: string,
  ): Promise<void> {
    const league = await this.prisma.league.findUnique({
      where: { id: leagueId },
      select: { ownerId: true },
    });
    if (!league) throw new NotFoundException('league not found');
    if (league.ownerId !== userId) throw new ForbiddenException('only the owner can link fixtures');

    const round = await this.prisma.round.findUnique({ where: { id: roundId } });
    if (!round || round.leagueId !== leagueId) throw new NotFoundException('round not found');

    const fixture = await this.prisma.fixtureFacts.findUnique({ where: { fixtureId } });
    if (!fixture) throw new NotFoundException('fixture not found — ingest it first');

    const existing = await this.prisma.fixtureRound.findUnique({
      where: { fixtureId_roundId: { fixtureId, roundId } },
    });
    if (existing) throw new ConflictException('fixture already linked to this round');

    await this.prisma.fixtureRound.create({ data: { fixtureId, roundId } });
  }

  async listFixturesForRound(leagueId: string, roundId: string): Promise<FixtureResponseDto[]> {
    const round = await this.prisma.round.findUnique({ where: { id: roundId } });
    if (!round || round.leagueId !== leagueId) throw new NotFoundException('round not found');

    const fixtureRounds = await this.prisma.fixtureRound.findMany({
      where: { roundId },
      include: { fixture: true },
    });

    return fixtureRounds.map((fr) => {
      const p = fr.fixture.payload as {
        homeTeam: { countryCode: string };
        awayTeam: { countryCode: string };
      };
      return {
        fixtureId: fr.fixture.fixtureId,
        status: fr.fixture.status as FixtureStatus,
        homeCountryCode: p.homeTeam.countryCode,
        awayCountryCode: p.awayTeam.countryCode,
        fetchedAt: fr.fixture.fetchedAt.toISOString(),
      };
    });
  }
}
