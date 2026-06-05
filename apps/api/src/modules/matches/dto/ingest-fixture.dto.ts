import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { FixtureStatus } from '@wcf/shared';

export class FixturePlayerStatsDto {
  @ApiProperty() @IsInt() externalId!: number;
  @ApiProperty() @IsInt() @Min(0) minutesPlayed!: number;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsNumber() @Min(0) @Max(10) rating!:
    | number
    | null;
  @ApiProperty() @IsInt() @Min(0) goals!: number;
  @ApiProperty() @IsInt() @Min(0) assists!: number;
  @ApiProperty() @IsInt() @Min(0) yellowCards!: number;
  @ApiProperty() @IsInt() @Min(0) redCards!: number;
  @ApiProperty() @IsInt() @Min(0) ownGoals!: number;
  @ApiProperty() @IsInt() @Min(0) penaltiesMissed!: number;
  @ApiProperty() @IsInt() @Min(0) penaltiesSaved!: number;
  @ApiProperty() @IsInt() @Min(0) saves!: number;
}

export class FixtureTeamStatsDto {
  @ApiProperty() @IsString() countryCode!: string;
  @ApiProperty() @IsInt() @Min(0) goalsConceded!: number;

  @ApiProperty({ type: [FixturePlayerStatsDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FixturePlayerStatsDto)
  players!: FixturePlayerStatsDto[];
}

export class IngestFixtureDto {
  @ApiProperty({ description: 'API-Football fixture ID — idempotency key' })
  @IsInt()
  fixtureId!: number;

  @ApiProperty({ enum: FixtureStatus })
  @IsEnum(FixtureStatus)
  status!: FixtureStatus;

  @ApiProperty({ type: FixtureTeamStatsDto })
  @ValidateNested()
  @Type(() => FixtureTeamStatsDto)
  homeTeam!: FixtureTeamStatsDto;

  @ApiProperty({ type: FixtureTeamStatsDto })
  @ValidateNested()
  @Type(() => FixtureTeamStatsDto)
  awayTeam!: FixtureTeamStatsDto;

  @ApiPropertyOptional({ description: 'If provided, links this fixture to the round' })
  @IsOptional()
  @IsString()
  roundId?: string;
}
