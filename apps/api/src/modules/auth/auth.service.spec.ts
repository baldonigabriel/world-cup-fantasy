import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from './auth.service';

const passwordHash = bcrypt.hashSync('password123', 10);

const mockUser = {
  id: 'user-1',
  username: 'johndoe',
  email: 'johndoe@example.com',
  teamName: 'Os Brabos FC',
  passwordHash,
  createdAt: new Date(),
};

const mockRefreshToken = {
  id: 'token-1',
  token: 'signed.refresh.token',
  userId: 'user-1',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  createdAt: new Date(),
};

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    delete: jest.fn(),
  },
};

const mockJwt = {
  sign: jest.fn().mockReturnValue('signed.jwt.token'),
};

const mockConfig = {
  get: jest.fn().mockReturnValue('test-secret-32-chars-long-xxxxxxxxx'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
    mockJwt.sign.mockReturnValue('signed.jwt.token');
  });

  describe('register', () => {
    it('creates user and returns tokens with user info', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);
      mockPrisma.refreshToken.create.mockResolvedValue(mockRefreshToken);

      const result = await service.register({
        username: 'johndoe',
        email: 'JohnDoe@Example.com',
        teamName: 'Os Brabos FC',
        password: 'password123',
      });

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ email: 'johndoe@example.com' }),
      });
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user).toMatchObject({
        id: 'user-1',
        username: 'johndoe',
        teamName: 'Os Brabos FC',
      });
    });

    it('throws ConflictException when username is already taken', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(mockUser);

      await expect(
        service.register({
          username: 'johndoe',
          email: 'johndoe@example.com',
          teamName: 'Os Brabos FC',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    it('throws ConflictException when email is already in use', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(mockUser);

      await expect(
        service.register({
          username: 'newdoe',
          email: 'johndoe@example.com',
          teamName: 'Os Brabos FC',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);

      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });
  });

  describe('login', () => {
    it('returns tokens with valid credentials using username', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.refreshToken.create.mockResolvedValue(mockRefreshToken);

      const result = await service.login({ identifier: 'johndoe', password: 'password123' });

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { username: 'johndoe' } });
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.username).toBe('johndoe');
    });

    it('returns tokens with valid credentials using email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.refreshToken.create.mockResolvedValue(mockRefreshToken);

      const result = await service.login({
        identifier: 'JohnDoe@Example.com',
        password: 'password123',
      });

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'johndoe@example.com' },
      });
      expect(result.user.username).toBe('johndoe');
    });

    it('throws UnauthorizedException when user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.login({ identifier: 'nobody', password: 'password' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException with wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.login({ identifier: 'johndoe', password: 'wrongpassword' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('deletes old token and issues new tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.refreshToken.delete.mockResolvedValue(mockRefreshToken);
      mockPrisma.refreshToken.create.mockResolvedValue(mockRefreshToken);

      const result = await service.refresh('user-1', 'johndoe', 'token-1');

      expect(mockPrisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'token-1' } });
      expect(result.accessToken).toBeDefined();
    });

    it('throws UnauthorizedException if user no longer exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.refresh('ghost-id', 'ghost', 'token-1')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('logout', () => {
    it('deletes the refresh token from DB', async () => {
      mockPrisma.refreshToken.delete.mockResolvedValue(mockRefreshToken);

      await service.logout('token-1');

      expect(mockPrisma.refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'token-1' } });
    });

    it('does not throw if token was already deleted', async () => {
      mockPrisma.refreshToken.delete.mockRejectedValue(new Error('record not found'));

      await expect(service.logout('token-1')).resolves.toBeUndefined();
    });
  });
});
