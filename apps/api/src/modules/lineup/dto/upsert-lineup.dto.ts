import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { LINEUP_STARTERS, LINEUP_SUBS } from '@wcf/shared';

export class LineupSlotInputDto {
  @ApiProperty()
  @IsString()
  playerId!: string;

  @ApiProperty({ minimum: 1, maximum: 15 })
  @IsInt()
  @Min(1)
  @Max(15)
  slotIndex!: number;

  @ApiProperty()
  @IsBoolean()
  isStarter!: boolean;
}

export class UpsertLineupDto {
  @ApiProperty({
    example: '4-4-2',
    description: 'Formation as DEF-MEI-ATA (sum must equal 10)',
  })
  @IsString()
  @Matches(/^\d+-\d+-\d+$/, { message: 'formation must be in DEF-MEI-ATA format (e.g. 4-4-2)' })
  formation!: string;

  @ApiProperty({ description: 'playerId of the captain — must be a starter' })
  @IsString()
  captainId!: string;

  @ApiProperty({ type: [LineupSlotInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(LINEUP_STARTERS + LINEUP_SUBS)
  @ArrayMaxSize(LINEUP_STARTERS + LINEUP_SUBS)
  @Type(() => LineupSlotInputDto)
  slots!: LineupSlotInputDto[];
}
