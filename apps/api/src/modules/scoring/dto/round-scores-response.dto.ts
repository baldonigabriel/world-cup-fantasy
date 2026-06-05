import { ApiProperty } from '@nestjs/swagger';
import { Position } from '@wcf/shared';

export class PlayerScoreResponseDto {
  @ApiProperty() playerId!: string;
  @ApiProperty() playerName!: string;
  @ApiProperty({ enum: Position }) position!: Position;
  @ApiProperty({ description: 'Points ×10 (divide by 10 for display)' }) points!: number;
  @ApiProperty() isCaptain!: boolean;
  @ApiProperty({ type: Object }) breakdown!: Record<string, number>;
}

export class TeamScoreResponseDto {
  @ApiProperty() rosterId!: string;
  @ApiProperty({ description: 'Total points ×10' }) totalPoints!: number;
  @ApiProperty({ type: [PlayerScoreResponseDto] }) playerScores!: PlayerScoreResponseDto[];
}

export class RoundScoresResponseDto {
  @ApiProperty() roundId!: string;
  @ApiProperty({ type: [TeamScoreResponseDto] }) teams!: TeamScoreResponseDto[];
}
