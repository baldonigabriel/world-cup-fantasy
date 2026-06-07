import { ApiProperty } from '@nestjs/swagger';
import { Position, TradeStatus } from '@wcf/shared';

export class TradePlayerDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: Position }) position!: Position;
  @ApiProperty() countryCode!: string;
}

export class TradeItemResponseDto {
  @ApiProperty() playerId!: string;
  @ApiProperty() fromRosterId!: string;
  @ApiProperty() toRosterId!: string;
  @ApiProperty({ type: () => TradePlayerDto }) player!: TradePlayerDto;
}

export class TradeResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ enum: TradeStatus }) status!: TradeStatus;
  @ApiProperty() leagueId!: string;
  @ApiProperty() proposerRosterId!: string;
  @ApiProperty() receiverRosterId!: string;
  @ApiProperty({ nullable: true }) tradeWindowId!: string | null;
  @ApiProperty({ type: [TradeItemResponseDto] }) items!: TradeItemResponseDto[];
  @ApiProperty() createdAt!: string;
}

export class FreeAgentResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: Position }) position!: Position;
  @ApiProperty() countryCode!: string;
  @ApiProperty() countryName!: string;
  @ApiProperty({ nullable: true }) photoUrl!: string | null;
}

export class RosterPlayerResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: Position }) position!: Position;
  @ApiProperty() countryCode!: string;
  @ApiProperty() countryName!: string;
  @ApiProperty({ nullable: true }) photoUrl!: string | null;
}
