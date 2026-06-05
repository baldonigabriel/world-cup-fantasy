import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Position } from '@wcf/shared';

export class LineupSlotPlayerDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: Position }) position!: Position;
  @ApiPropertyOptional() photoUrl!: string | null;
  @ApiProperty() countryCode!: string;
}

export class LineupSlotResponseDto {
  @ApiProperty() slotIndex!: number;
  @ApiProperty() isStarter!: boolean;
  @ApiProperty({ type: LineupSlotPlayerDto }) player!: LineupSlotPlayerDto;
}

export class LineupResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() rosterId!: string;
  @ApiProperty() roundId!: string;
  @ApiProperty() formation!: string;
  @ApiProperty() captainId!: string;
  @ApiProperty({ type: [LineupSlotResponseDto] }) slots!: LineupSlotResponseDto[];
  @ApiProperty() updatedAt!: string;
}
