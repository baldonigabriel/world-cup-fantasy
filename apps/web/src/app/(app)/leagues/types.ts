import { DraftStatus } from '@wcf/shared';

export interface LeagueMemberDto {
  membershipId: string;
  rosterId: string;
  userId: string;
  username: string;
  teamName: string;
}

export interface LeagueResponseDto {
  id: string;
  name: string;
  inviteCode: string;
  ownerId: string;
  maxTeams: number;
  memberCount: number;
  draftStatus: DraftStatus | null;
  members: LeagueMemberDto[];
}
