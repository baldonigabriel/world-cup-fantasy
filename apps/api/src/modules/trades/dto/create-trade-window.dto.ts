import { ApiProperty } from '@nestjs/swagger';
import { IsDateString } from 'class-validator';

export class CreateTradeWindowDto {
  @ApiProperty({ example: '2026-06-20T00:00:00Z' })
  @IsDateString()
  opensAt!: string;

  @ApiProperty({ example: '2026-06-24T23:59:59Z' })
  @IsDateString()
  closesAt!: string;
}
