import { DraftStatus, Position } from '@wcf/shared';

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

export interface DraftPickPlayerDto {
  id: string;
  name: string;
  position: Position;
  photoUrl: string | null;
  countryName: string;
  countryCode: string;
}

export interface DraftPickDto {
  pickIndex: number;
  membershipId: string;
  player: DraftPickPlayerDto;
  pickedAt: string;
}

export interface DraftStateDto {
  status: DraftStatus;
  currentPick: number;
  totalPicks: number;
  nextMembershipId: string | null;
  order: string[]; // membershipIds in snake order
  picks: DraftPickDto[];
}
