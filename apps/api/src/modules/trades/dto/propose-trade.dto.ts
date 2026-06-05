import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ProposeTradeDto {
  @ApiProperty({ description: 'Player from your roster to offer' })
  @IsString()
  offeredPlayerId!: string;

  @ApiProperty({ description: 'Player from the other team you want' })
  @IsString()
  requestedPlayerId!: string;

  @ApiProperty({ description: 'rosterId of the team you are trading with' })
  @IsString()
  receiverRosterId!: string;
}
