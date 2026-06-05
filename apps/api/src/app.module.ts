import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import * as Joi from 'joi';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { LeaguesModule } from './modules/leagues/leagues.module';
import { DraftModule } from './modules/draft/draft.module';
import { PlayersModule } from './modules/players/players.module';
import { MatchesModule } from './modules/matches/matches.module';
import { ScoringModule } from './modules/scoring/scoring.module';
import { TradesModule } from './modules/trades/trades.module';
import { StandingsModule } from './modules/standings/standings.module';
import { LineupModule } from './modules/lineup/lineup.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        PORT: Joi.number().default(3001),
        DATABASE_URL: Joi.string().required(),
        REDIS_URL: Joi.string().optional(),
        JWT_ACCESS_SECRET: Joi.string().min(32).required(),
        JWT_REFRESH_SECRET: Joi.string().min(32).required(),
        API_FOOTBALL_KEY: Joi.string().optional(),
        CORS_ORIGIN: Joi.string().default('http://localhost:3000'),
      }),
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    LeaguesModule,
    DraftModule,
    PlayersModule,
    MatchesModule,
    ScoringModule,
    TradesModule,
    StandingsModule,
    LineupModule,
  ],
})
export class AppModule {}
