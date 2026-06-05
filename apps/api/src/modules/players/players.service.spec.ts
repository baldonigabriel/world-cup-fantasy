import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { Position } from '@wcf/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { normalizePosition, PlayersService } from './players.service';

const mockCountry = { id: 'c-1', name: 'Brazil', code: 'Brazil', flagUrl: null };
const mockPlayer = {
  id: 'p-1',
  name: 'Vini Jr',
  position: 'ATA',
  countryId: 'c-1',
  externalId: 123,
  photoUrl: null,
  country: mockCountry,
};

const mockPrisma = {
  country: { upsert: jest.fn().mockResolvedValue(mockCountry) },
  player: {
    upsert: jest.fn().mockResolvedValue(mockPlayer),
    findMany: jest.fn().mockResolvedValue([{ ...mockPlayer, country: mockCountry }]),
  },
};

const mockConfig = {
  get: jest.fn().mockReturnValue('test-api-key'),
};

interface MockApiPlayer {
  player: { id: number; name: string; nationality: string; photo: null };
  statistics: [{ games: { position: string } }];
}

const makeApiResponse = (players: MockApiPlayer[], page = 1, totalPages = 1) => ({
  response: players,
  paging: { current: page, total: totalPages },
});

const makeApiPlayer = (
  id: number,
  name: string,
  position: string,
  nationality: string,
): MockApiPlayer => ({
  player: { id, name, nationality, photo: null },
  statistics: [{ games: { position } }],
});

describe('normalizePosition', () => {
  it.each([
    ['Goalkeeper', Position.GOL],
    ['Defender', Position.DEF],
    ['Midfielder', Position.MEI],
    ['Attacker', Position.ATA],
    ['Forward', Position.ATA],
  ])('maps %s → %s', (raw, expected) => {
    expect(normalizePosition(raw)).toBe(expected);
  });

  it('returns null for unknown position', () => {
    expect(normalizePosition('Coach')).toBeNull();
    expect(normalizePosition(null)).toBeNull();
    expect(normalizePosition(undefined)).toBeNull();
  });
});

describe('PlayersService', () => {
  let service: PlayersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlayersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<PlayersService>(PlayersService);
    jest.clearAllMocks();
    mockPrisma.country.upsert.mockResolvedValue(mockCountry);
    mockPrisma.player.upsert.mockResolvedValue(mockPlayer);
  });

  describe('importFromApiFootball', () => {
    it('imports players and returns count', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () =>
          makeApiResponse([
            makeApiPlayer(1, 'Vini Jr', 'Attacker', 'Brazil'),
            makeApiPlayer(2, 'Alisson', 'Goalkeeper', 'Brazil'),
          ]),
      } as Response);

      const result = await service.importFromApiFootball();

      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(0);
      expect(mockPrisma.player.upsert).toHaveBeenCalledTimes(2);
    });

    it('skips players with unknown position', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () =>
          makeApiResponse([
            makeApiPlayer(1, 'Vini Jr', 'Attacker', 'Brazil'),
            makeApiPlayer(2, 'Jose Coach', 'Coach', 'Brazil'),
          ]),
      } as Response);

      const result = await service.importFromApiFootball();

      expect(result.imported).toBe(1);
      expect(result.skipped).toBe(1);
    });

    it('is idempotent — upsert called with same key on second run', async () => {
      const response = {
        ok: true,
        json: async () => makeApiResponse([makeApiPlayer(1, 'Vini Jr', 'Attacker', 'Brazil')]),
      } as Response;

      jest.spyOn(global, 'fetch').mockResolvedValue(response);

      await service.importFromApiFootball();
      await service.importFromApiFootball();

      // Both calls upsert by the same externalId
      const calls = mockPrisma.player.upsert.mock.calls;
      expect(calls[0][0].where).toEqual(calls[1][0].where);
    });

    it('throws when API_FOOTBALL_KEY is not set', async () => {
      mockConfig.get.mockReturnValueOnce(undefined);
      await expect(service.importFromApiFootball()).rejects.toThrow(
        'API_FOOTBALL_KEY not configured',
      );
    });
  });

  describe('findAll', () => {
    it('returns mapped players', async () => {
      mockPrisma.player.findMany.mockResolvedValue([{ ...mockPlayer, country: mockCountry }]);

      const result = await service.findAll({});

      expect(result).toHaveLength(1);
      expect(result[0].position).toBe(Position.ATA);
      expect(result[0].country.code).toBe('Brazil');
    });

    it('applies leagueId filter to exclude drafted players', async () => {
      mockPrisma.player.findMany.mockResolvedValue([]);

      await service.findAll({ leagueId: 'league-1' });

      expect(mockPrisma.player.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            rosterPlayers: { none: { leagueId: 'league-1' } },
          }),
        }),
      );
    });
  });
});
