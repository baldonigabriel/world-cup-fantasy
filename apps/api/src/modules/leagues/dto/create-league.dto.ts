import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateLeagueDto {
  @ApiProperty({ example: 'Liga dos Amigos' })
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name!: string;

  @ApiPropertyOptional({ default: 8, minimum: 2, maximum: 16 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(16)
  maxTeams?: number;
}
