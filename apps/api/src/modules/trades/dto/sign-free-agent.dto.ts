import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SignFreeAgentDto {
  @ApiProperty({ description: 'Free agent playerId to sign' })
  @IsString()
  signPlayerId!: string;

  @ApiProperty({ description: 'Player from your roster to release (same position)' })
  @IsString()
  releasePlayerId!: string;
}
