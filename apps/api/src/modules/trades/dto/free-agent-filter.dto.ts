import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Position } from '@wcf/shared';

export class FreeAgentFilterDto {
  @ApiPropertyOptional({ enum: Position })
  @IsOptional()
  @IsEnum(Position)
  position?: Position;

  @ApiPropertyOptional({ description: '3-letter country code, e.g. BRA' })
  @IsOptional()
  @IsString()
  countryCode?: string;
}
