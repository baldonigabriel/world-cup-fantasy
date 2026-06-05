// ─── Enums ────────────────────────────────────────────────────────────────────

export enum Position {
  GOL = 'GOL',
  DEF = 'DEF',
  MEI = 'MEI',
  ATA = 'ATA',
}

export enum DraftStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

export enum RoundStage {
  GROUP_1 = 'GROUP_1',
  GROUP_2 = 'GROUP_2',
  GROUP_3 = 'GROUP_3',
  R32 = 'R32',
  R16 = 'R16',
  QF = 'QF',
  SF = 'SF',
  FINAL = 'FINAL',
}

export enum TradeStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

export enum FixtureStatus {
  SCHEDULED = 'SCHEDULED',
  LIVE = 'LIVE',
  FINISHED = 'FINISHED',
  CANCELLED = 'CANCELLED',
}

// ─── Domain constants ─────────────────────────────────────────────────────────

export const ROSTER_QUOTAS: Record<Position, number> = {
  [Position.GOL]: 2,
  [Position.DEF]: 5,
  [Position.MEI]: 4,
  [Position.ATA]: 4,
};

export const ROSTER_SIZE = 15;
export const LINEUP_STARTERS = 11;
export const LINEUP_SUBS = 4;

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface CountryDto {
  id: string;
  name: string;
  code: string;
  flagUrl: string | null;
}

export interface PlayerDto {
  id: string;
  name: string;
  position: Position;
  country: CountryDto;
  photoUrl: string | null;
}

export interface UserDto {
  id: string;
  username: string;
  teamName: string;
}

export interface LeagueDto {
  id: string;
  name: string;
  inviteCode: string;
  maxTeams: number;
  memberCount: number;
}

export interface MemberDto {
  id: string;
  user: UserDto;
}

export interface RosterPlayerDto {
  id: string;
  player: PlayerDto;
}

export interface DraftStateDto {
  status: DraftStatus;
  currentPick: number;
  order: string[]; // membershipIds
  picks: DraftPickDto[];
}

export interface DraftPickDto {
  membershipId: string;
  player: PlayerDto;
  pickIndex: number;
  pickedAt: string;
}

export interface LineupSlotDto {
  playerId: string;
  slotIndex: number;
  isStarter: boolean;
}

export interface LineupDto {
  formation: string;
  captainId: string;
  slots: LineupSlotDto[];
}

export interface StandingEntryDto {
  rank: number;
  rosterId: string;
  teamName: string;
  username: string;
  totalPoints: number;
  roundPoints: Record<string, number>;
}

export interface TradeDto {
  id: string;
  status: TradeStatus;
  proposerRosterId: string;
  receiverRosterId: string;
  items: TradeItemDto[];
  createdAt: string;
}

export interface TradeItemDto {
  playerId: string;
  fromRosterId: string;
  toRosterId: string;
  player: PlayerDto;
}

// ─── API response envelope ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
