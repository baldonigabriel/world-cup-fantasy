-- CreateEnum
CREATE TYPE "Position" AS ENUM ('GOL', 'DEF', 'MEI', 'ATA');

-- CreateEnum
CREATE TYPE "DraftStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RoundStage" AS ENUM ('GROUP_1', 'GROUP_2', 'GROUP_3', 'R32', 'R16', 'QF', 'SF', 'FINAL');

-- CreateEnum
CREATE TYPE "FixtureStatus" AS ENUM ('SCHEDULED', 'LIVE', 'FINISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "teamName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Country" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "flagUrl" TEXT,

    CONSTRAINT "Country_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" "Position" NOT NULL,
    "countryId" TEXT NOT NULL,
    "externalId" INTEGER,
    "photoUrl" TEXT,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "League" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inviteCode" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "maxTeams" INTEGER NOT NULL DEFAULT 8,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "League_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Roster" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,

    CONSTRAINT "Roster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterPlayer" (
    "id" TEXT NOT NULL,
    "rosterId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "countryId" TEXT NOT NULL,

    CONSTRAINT "RosterPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftState" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "status" "DraftStatus" NOT NULL DEFAULT 'PENDING',
    "order" TEXT[],
    "currentPick" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DraftState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DraftPick" (
    "id" TEXT NOT NULL,
    "draftStateId" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "pickIndex" INTEGER NOT NULL,
    "pickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DraftPick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Round" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "stage" "RoundStage" NOT NULL,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "lockAt" TIMESTAMP(3) NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Round_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lineup" (
    "id" TEXT NOT NULL,
    "rosterId" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "formation" TEXT NOT NULL,
    "captainId" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lineup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineupSlot" (
    "id" TEXT NOT NULL,
    "lineupId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "isStarter" BOOLEAN NOT NULL,

    CONSTRAINT "LineupSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineupSnapshot" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "rosterId" TEXT NOT NULL,
    "captainId" TEXT NOT NULL,
    "formation" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LineupSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LineupSnapshotSlot" (
    "id" TEXT NOT NULL,
    "lineupSnapshotId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "isStarter" BOOLEAN NOT NULL,

    CONSTRAINT "LineupSnapshotSlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixtureFacts" (
    "id" TEXT NOT NULL,
    "fixtureId" INTEGER NOT NULL,
    "status" "FixtureStatus" NOT NULL DEFAULT 'SCHEDULED',
    "homeCountryId" TEXT,
    "awayCountryId" TEXT,
    "payload" JSONB NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FixtureFacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixtureRound" (
    "fixtureId" INTEGER NOT NULL,
    "roundId" TEXT NOT NULL,

    CONSTRAINT "FixtureRound_pkey" PRIMARY KEY ("fixtureId","roundId")
);

-- CreateTable
CREATE TABLE "PlayerRoundScore" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "rosterId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "lineupSnapshotId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "isCaptain" BOOLEAN NOT NULL DEFAULT false,
    "breakdown" JSONB NOT NULL,

    CONSTRAINT "PlayerRoundScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamRoundScore" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "rosterId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,

    CONSTRAINT "TeamRoundScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeWindow" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeWindow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "tradeWindowId" TEXT,
    "proposerRosterId" TEXT NOT NULL,
    "receiverRosterId" TEXT NOT NULL,
    "status" "TradeStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeItem" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "fromRosterId" TEXT NOT NULL,
    "toRosterId" TEXT NOT NULL,

    CONSTRAINT "TradeItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_token_key" ON "RefreshToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Country_code_key" ON "Country"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Player_externalId_key" ON "Player"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "League_inviteCode_key" ON "League"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_leagueId_userId_key" ON "Membership"("leagueId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Roster_membershipId_key" ON "Roster"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterPlayer_leagueId_playerId_key" ON "RosterPlayer"("leagueId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "RosterPlayer_rosterId_countryId_key" ON "RosterPlayer"("rosterId", "countryId");

-- CreateIndex
CREATE UNIQUE INDEX "DraftState_leagueId_key" ON "DraftState"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "Lineup_rosterId_roundId_key" ON "Lineup"("rosterId", "roundId");

-- CreateIndex
CREATE UNIQUE INDEX "LineupSnapshot_roundId_rosterId_key" ON "LineupSnapshot"("roundId", "rosterId");

-- CreateIndex
CREATE UNIQUE INDEX "FixtureFacts_fixtureId_key" ON "FixtureFacts"("fixtureId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayerRoundScore_roundId_rosterId_playerId_key" ON "PlayerRoundScore"("roundId", "rosterId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "TeamRoundScore_roundId_rosterId_key" ON "TeamRoundScore"("roundId", "rosterId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Roster" ADD CONSTRAINT "Roster_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterPlayer" ADD CONSTRAINT "RosterPlayer_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "Roster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterPlayer" ADD CONSTRAINT "RosterPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterPlayer" ADD CONSTRAINT "RosterPlayer_countryId_fkey" FOREIGN KEY ("countryId") REFERENCES "Country"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftState" ADD CONSTRAINT "DraftState_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftPick" ADD CONSTRAINT "DraftPick_draftStateId_fkey" FOREIGN KEY ("draftStateId") REFERENCES "DraftState"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftPick" ADD CONSTRAINT "DraftPick_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Round" ADD CONSTRAINT "Round_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lineup" ADD CONSTRAINT "Lineup_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "Roster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lineup" ADD CONSTRAINT "Lineup_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupSlot" ADD CONSTRAINT "LineupSlot_lineupId_fkey" FOREIGN KEY ("lineupId") REFERENCES "Lineup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupSlot" ADD CONSTRAINT "LineupSlot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupSnapshot" ADD CONSTRAINT "LineupSnapshot_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupSnapshot" ADD CONSTRAINT "LineupSnapshot_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "Roster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupSnapshotSlot" ADD CONSTRAINT "LineupSnapshotSlot_lineupSnapshotId_fkey" FOREIGN KEY ("lineupSnapshotId") REFERENCES "LineupSnapshot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LineupSnapshotSlot" ADD CONSTRAINT "LineupSnapshotSlot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixtureRound" ADD CONSTRAINT "FixtureRound_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "FixtureFacts"("fixtureId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixtureRound" ADD CONSTRAINT "FixtureRound_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerRoundScore" ADD CONSTRAINT "PlayerRoundScore_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerRoundScore" ADD CONSTRAINT "PlayerRoundScore_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "Roster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerRoundScore" ADD CONSTRAINT "PlayerRoundScore_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerRoundScore" ADD CONSTRAINT "PlayerRoundScore_lineupSnapshotId_fkey" FOREIGN KEY ("lineupSnapshotId") REFERENCES "LineupSnapshot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamRoundScore" ADD CONSTRAINT "TeamRoundScore_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamRoundScore" ADD CONSTRAINT "TeamRoundScore_rosterId_fkey" FOREIGN KEY ("rosterId") REFERENCES "Roster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeWindow" ADD CONSTRAINT "TradeWindow_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_tradeWindowId_fkey" FOREIGN KEY ("tradeWindowId") REFERENCES "TradeWindow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_proposerRosterId_fkey" FOREIGN KEY ("proposerRosterId") REFERENCES "Roster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_receiverRosterId_fkey" FOREIGN KEY ("receiverRosterId") REFERENCES "Roster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeItem" ADD CONSTRAINT "TradeItem_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
