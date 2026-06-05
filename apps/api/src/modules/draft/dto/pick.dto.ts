import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class PickDto {
  @ApiProperty({ description: 'ID of the player to draft' })
  @IsString()
  playerId!: string;
}
