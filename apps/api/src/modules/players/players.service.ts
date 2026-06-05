import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { Position } from '@wcf/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { PlayerFilterDto } from './dto/player-filter.dto';
import { ImportResultDto, PlayerResponseDto } from './dto/player-response.dto';

const API_FOOTBALL_BASE = 'https://v3.football.api-sports.io';
const WORLD_CUP_2026_LEAGUE_ID = 1;
const WORLD_CUP_2026_SEASON = 2026;

interface ApiFootballPlayer {
  id: number;
  name: string;
  nationality: string;
  photo: string | null;
}

interface ApiFootballStatistics {
  games: { position: string | null } | null;
}

interface ApiFootballResponseItem {
  player: ApiFootballPlayer;
  statistics: ApiFootballStatistics[];
}

interface ApiFootballResponse {
  response: ApiFootballResponseItem[];
  paging: { current: number; total: number };
}

const POSITION_MAP: Record<string, Position> = {
  Goalkeeper: Position.GOL,
  Defender: Position.DEF,
  Midfielder: Position.MEI,
  Attacker: Position.ATA,
  Forward: Position.ATA,
};

export function normalizePosition(raw: string | null | undefined): Position | null {
  if (!raw) return null;
  return POSITION_MAP[raw] ?? null;
}

@Injectable()
export class PlayersService {
  private readonly logger = new Logger(PlayersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async importFromApiFootball(): Promise<ImportResultDto> {
    const apiKey = this.configService.get<string>('API_FOOTBALL_KEY');
    if (!apiKey) throw new Error('API_FOOTBALL_KEY not configured');

    let imported = 0;
    let skipped = 0;
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const data = await this.fetchApiFootball(
        `/players?league=${WORLD_CUP_2026_LEAGUE_ID}&season=${WORLD_CUP_2026_SEASON}&page=${page}`,
        apiKey,
      );

      totalPages = data.paging?.total ?? 1;

      for (const item of data.response) {
        const playerData = item.player;
        const stats = item.statistics?.[0];
        const position = normalizePosition(stats?.games?.position);

        if (!position) {
          this.logger.debug(`Skipping player ${playerData?.name} — unknown position`);
          skipped++;
          continue;
        }

        const nationalityCode = playerData.nationality ?? 'UNK';

        const country = await this.prisma.country.upsert({
          where: { code: nationalityCode },
          create: { name: playerData.nationality ?? nationalityCode, code: nationalityCode },
          update: {},
        });

        await this.prisma.player.upsert({
          where: { externalId: playerData.id },
          create: {
            name: playerData.name,
            position,
            countryId: country.id,
            externalId: playerData.id,
            photoUrl: playerData.photo ?? null,
          },
          update: {
            name: playerData.name,
            position,
            photoUrl: playerData.photo ?? null,
          },
        });

        imported++;
      }

      page++;
    }

    this.logger.log(`Import complete: ${imported} imported, ${skipped} skipped`);
    return { imported, skipped };
  }

  async findAll(dto: PlayerFilterDto): Promise<PlayerResponseDto[]> {
    const where: Prisma.PlayerWhereInput = {};

    if (dto.position) where.position = dto.position;
    if (dto.countryId) where.countryId = dto.countryId;
    if (dto.leagueId) {
      where.rosterPlayers = { none: { leagueId: dto.leagueId } };
    }

    const players = await this.prisma.player.findMany({
      where,
      include: { country: true },
      orderBy: [{ country: { name: 'asc' } }, { name: 'asc' }],
      take: dto.limit ?? 50,
      skip: dto.offset ?? 0,
    });

    return players.map((p) => ({
      id: p.id,
      name: p.name,
      position: p.position as Position,
      photoUrl: p.photoUrl,
      country: {
        id: p.country.id,
        name: p.country.name,
        code: p.country.code,
        flagUrl: p.country.flagUrl,
      },
    }));
  }

  private async fetchApiFootball(path: string, apiKey: string): Promise<ApiFootballResponse> {
    const res = await fetch(`${API_FOOTBALL_BASE}${path}`, {
      headers: { 'x-apisports-key': apiKey },
    });
    if (!res.ok) throw new Error(`API-Football error: ${res.status} ${res.statusText}`);
    return res.json() as Promise<ApiFootballResponse>;
  }
}
