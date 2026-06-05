import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsEnum } from 'class-validator';
import { RoundStage } from '@wcf/shared';

export class CreateRoundDto {
  @ApiProperty({ enum: RoundStage })
  @IsEnum(RoundStage)
  stage!: RoundStage;

  @ApiProperty({ example: '2026-06-11T18:00:00Z' })
  @IsDateString()
  opensAt!: string;

  @ApiProperty({ example: '2026-06-11T21:00:00Z' })
  @IsDateString()
  lockAt!: string;
}
