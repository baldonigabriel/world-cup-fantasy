import { ApiProperty } from '@nestjs/swagger';

export class TradeWindowResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() leagueId!: string;
  @ApiProperty() opensAt!: string;
  @ApiProperty() closesAt!: string;
  @ApiProperty({ description: 'True when now is within [opensAt, closesAt]' }) isOpen!: boolean;
}
