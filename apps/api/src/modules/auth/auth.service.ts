import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { TokenResponseDto } from './dto/token-response.dto';

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto): Promise<TokenResponseDto> {
    const email = dto.email.toLowerCase();

    const existingUsername = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existingUsername) throw new ConflictException('username already taken');

    const existingEmail = await this.prisma.user.findUnique({ where: { email } });
    if (existingEmail) throw new ConflictException('email already in use');

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: { username: dto.username, email, teamName: dto.teamName, passwordHash },
    });

    return this.issueTokens(user.id, user.username, user.teamName);
  }

  async login(dto: LoginDto): Promise<TokenResponseDto> {
    const isEmail = dto.identifier.includes('@');
    const user = await this.prisma.user.findUnique({
      where: isEmail ? { email: dto.identifier.toLowerCase() } : { username: dto.identifier },
    });
    if (!user) throw new UnauthorizedException('invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('invalid credentials');

    return this.issueTokens(user.id, user.username, user.teamName);
  }

  async refresh(
    userId: string,
    username: string,
    refreshTokenId: string,
  ): Promise<TokenResponseDto> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException();

    await this.prisma.refreshToken.delete({ where: { id: refreshTokenId } });
    return this.issueTokens(user.id, user.username, user.teamName);
  }

  async logout(refreshTokenId: string): Promise<void> {
    await this.prisma.refreshToken.delete({ where: { id: refreshTokenId } }).catch(() => {
      // Token already deleted or not found — silent no-op
    });
  }

  private async issueTokens(
    userId: string,
    username: string,
    teamName: string,
  ): Promise<TokenResponseDto> {
    const accessToken = this.jwtService.sign(
      { sub: userId, username },
      { secret: this.configService.get<string>('JWT_ACCESS_SECRET'), expiresIn: '15m' },
    );

    const refreshToken = this.jwtService.sign(
      { sub: userId, username },
      { secret: this.configService.get<string>('JWT_REFRESH_SECRET'), expiresIn: '7d' },
    );

    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
    await this.prisma.refreshToken.create({ data: { token: refreshToken, userId, expiresAt } });

    return { accessToken, refreshToken, user: { id: userId, username, teamName } };
  }
}
