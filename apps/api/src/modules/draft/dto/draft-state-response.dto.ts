import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DraftStatus, Position } from '@wcf/shared';

export class DraftPickPlayerDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: Position })
  position!: Position;

  @ApiPropertyOptional()
  photoUrl!: string | null;

  @ApiProperty()
  countryName!: string;

  @ApiProperty()
  countryCode!: string;
}

export class DraftPickResponseDto {
  @ApiProperty()
  pickIndex!: number;

  @ApiProperty()
  membershipId!: string;

  @ApiProperty({ type: DraftPickPlayerDto })
  player!: DraftPickPlayerDto;

  @ApiProperty()
  pickedAt!: string;
}

export class DraftStateResponseDto {
  @ApiProperty({ enum: DraftStatus })
  status!: DraftStatus;

  @ApiProperty()
  currentPick!: number;

  @ApiProperty()
  totalPicks!: number;

  @ApiPropertyOptional({
    description: 'membershipId of the team picking next; null when completed',
  })
  nextMembershipId!: string | null;

  @ApiProperty({ type: [String] })
  order!: string[];

  @ApiProperty({ type: [DraftPickResponseDto] })
  picks!: DraftPickResponseDto[];
}
