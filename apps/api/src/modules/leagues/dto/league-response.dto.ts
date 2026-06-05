import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DraftStatus } from '@wcf/shared';

export class LeagueMemberDto {
  @ApiProperty()
  membershipId!: string;

  @ApiProperty()
  rosterId!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  username!: string;

  @ApiProperty()
  teamName!: string;
}

export class LeagueResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  inviteCode!: string;

  @ApiProperty()
  ownerId!: string;

  @ApiProperty()
  maxTeams!: number;

  @ApiProperty()
  memberCount!: number;

  @ApiPropertyOptional({ enum: DraftStatus })
  draftStatus!: DraftStatus | null;

  @ApiProperty({ type: [LeagueMemberDto] })
  members!: LeagueMemberDto[];
}
