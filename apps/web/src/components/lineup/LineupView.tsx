'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DraftStatus, Position } from '@wcf/shared';
import { useAuthStore } from '@/store/auth.store';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { LeagueResponseDto } from '@/app/(app)/leagues/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Round {
  id: string;
  stage: string;
  opensAt: string;
  lockAt: string;
  locked: boolean;
}

interface RosterPlayer {
  id: string;
  name: string;
  position: Position;
  countryCode: string;
  photoUrl: string | null;
}

interface LineupSlot {
  slotIndex: number;
  isStarter: boolean;
  player: {
    id: string;
    name: string;
    position: Position;
    photoUrl: string | null;
    countryCode: string;
  };
}

interface LineupData {
  id: string;
  rosterId: string;
  roundId: string;
  formation: string;
  captainId: string;
  slots: LineupSlot[];
  updatedAt: string;
}

interface DraftState {
  status: DraftStatus;
  picks: Array<{
    membershipId: string;
    pickIndex: number;
    player: {
      id: string;
      name: string;
      position: Position;
      photoUrl: string | null;
      countryCode: string;
    };
  }>;
  order: string[];
  currentPick: number;
  totalPicks: number;
  nextMembershipId: string | null;
}

interface PlayerScore {
  playerId: string;
  points: number;
  isCaptain: boolean;
  breakdown: Record<string, number>;
}

interface RoundScores {
  roundId: string;
  teams: Array<{ rosterId: string; totalPoints: number; playerScores: PlayerScore[] }>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Valid formations: DEF(1-5) + MEI(1-4) + ATA(1-4) = 10
const VALID_FORMATIONS = [
  '4-3-3',
  '4-4-2',
  '4-2-4',
  '5-4-1',
  '5-3-2',
  '5-2-3',
  '5-1-4',
  '3-4-3',
  '3-3-4',
  '2-4-4',
] as const;

const POSITION_ORDER: Record<Position, number> = {
  [Position.GOL]: 0,
  [Position.DEF]: 1,
  [Position.MEI]: 2,
  [Position.ATA]: 3,
};

const POSITION_TEXT: Record<Position, string> = {
  [Position.GOL]: 'text-amber-400',
  [Position.DEF]: 'text-sky-400',
  [Position.MEI]: 'text-emerald-400',
  [Position.ATA]: 'text-red-400',
};

const POSITION_CHIP: Record<Position, string> = {
  [Position.GOL]: 'text-amber-400 bg-amber-500/20',
  [Position.DEF]: 'text-sky-400 bg-sky-500/20',
  [Position.MEI]: 'text-emerald-400 bg-emerald-500/20',
  [Position.ATA]: 'text-red-400 bg-red-500/20',
};

// Order mirrors specs/scoring.md §2 (positives, then bonus, then negatives).
// Keys match scoring.engine.ts ScoreResult.breakdown; "subtotal" is rendered separately.
const BREAKDOWN_LABELS: Array<{ key: string; label: string }> = [
  { key: 'goals', label: 'Gol' },
  { key: 'assists', label: 'Assistência' },
  { key: 'cleanSheet', label: 'Clean sheet' },
  { key: 'penaltiesSaved', label: 'Pênalti defendido' },
  { key: 'ratingBonus', label: 'Bônus de nota' },
  { key: 'goalsConceded', label: 'Gols sofridos' },
  { key: 'yellowCards', label: 'Cartão amarelo' },
  { key: 'redCards', label: 'Cartão vermelho' },
  { key: 'penaltiesMissed', label: 'Pênalti perdido' },
  { key: 'ownGoals', label: 'Gol contra' },
];

const STAGE_LABEL: Record<string, string> = {
  GROUP_1: 'Grupos 1',
  GROUP_2: 'Grupos 2',
  GROUP_3: 'Grupos 3',
  R32: 'Oitavos',
  R16: 'Oitavos',
  QF: 'Quartas',
  SF: 'Semis',
  FINAL: 'Final',
};

// ─── Pure helpers ─────────────────────────────────────────────────────────────

function parseFormationParts(f: string): { def: number; mei: number; ata: number } | null {
  const p = f.split('-').map(Number);
  if (p.length !== 3 || p.some(isNaN)) return null;
  return { def: p[0], mei: p[1], ata: p[2] };
}

function formationQuota(
  pos: Position,
  parts: { def: number; mei: number; ata: number } | null,
): number {
  if (!parts) return 0;
  switch (pos) {
    case Position.GOL:
      return 1;
    case Position.DEF:
      return parts.def;
    case Position.MEI:
      return parts.mei;
    case Position.ATA:
      return parts.ata;
  }
}

function lastName(name: string): string {
  const parts = name.trim().split(' ');
  return parts[parts.length - 1];
}

// Points are stored ×10 (see specs/scoring.md §1).
function formatPoints(pointsX10: number): string {
  return (pointsX10 / 10).toFixed(1);
}

// Format with an explicit sign for breakdown line items (e.g. "+8.0", "−1.0").
function formatSigned(pointsX10: number): string {
  const value = pointsX10 / 10;
  if (value === 0) return '0.0';
  const sign = value > 0 ? '+' : '−';
  return `${sign}${Math.abs(value).toFixed(1)}`;
}

// ─── Countdown hook ───────────────────────────────────────────────────────────

function useCountdown(target: string | null): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const diff = new Date(target).getTime() - Date.now();
    if (diff <= 0 || diff > 86_400_000) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  if (!target) return null;
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return 'ENCERRADO';
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LineupView({ leagueId }: { leagueId: string }) {
  const { accessToken, user } = useAuthStore();
  const queryClient = useQueryClient();

  // ── UI state ───────────────────────────────────────────────────────────────
  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);
  const [formation, setFormation] = useState('4-3-3');
  const [starterIds, setStarterIds] = useState<Set<string>>(new Set());
  const [captainId, setCaptainId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<'field' | 'roster'>('field');
  const [breakdownPlayerId, setBreakdownPlayerId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: league } = useQuery<LeagueResponseDto>({
    queryKey: ['league', leagueId],
    queryFn: () => api.get<LeagueResponseDto>(`/leagues/${leagueId}`, accessToken ?? undefined),
    enabled: !!accessToken,
  });

  const { data: draft } = useQuery<DraftState>({
    queryKey: ['draft', leagueId],
    queryFn: () => api.get<DraftState>(`/leagues/${leagueId}/draft`, accessToken ?? undefined),
    enabled: !!accessToken,
  });

  const { data: rounds = [], isLoading: roundsLoading } = useQuery<Round[]>({
    queryKey: ['rounds', leagueId],
    queryFn: () => api.get<Round[]>(`/leagues/${leagueId}/rounds`, accessToken ?? undefined),
    enabled: !!accessToken,
  });

  const { data: existingLineup = null, isLoading: lineupLoading } = useQuery<LineupData | null>({
    queryKey: ['lineup', leagueId, selectedRoundId],
    queryFn: async () => {
      try {
        return await api.get<LineupData>(
          `/leagues/${leagueId}/rounds/${selectedRoundId}/lineup`,
          accessToken ?? undefined,
        );
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },
    enabled: !!accessToken && !!selectedRoundId,
  });

  const { data: scores = null } = useQuery<RoundScores | null>({
    queryKey: ['scores', leagueId, selectedRoundId],
    queryFn: async () => {
      try {
        return await api.get<RoundScores>(
          `/leagues/${leagueId}/rounds/${selectedRoundId}/scores`,
          accessToken ?? undefined,
        );
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },
    enabled: !!accessToken && !!selectedRoundId,
  });

  // ── Mutation — defined before derived state that reads isPending ────────────

  const saveMutation = useMutation({
    mutationFn: (body: {
      formation: string;
      captainId: string;
      slots: Array<{ playerId: string; slotIndex: number; isStarter: boolean }>;
    }) =>
      api.put<LineupData>(
        `/leagues/${leagueId}/rounds/${selectedRoundId}/lineup`,
        body,
        accessToken ?? undefined,
      ),
    onSuccess: () => {
      setSaveError('');
      setSaveSuccess(true);
      queryClient.invalidateQueries({ queryKey: ['lineup', leagueId, selectedRoundId] });
      setTimeout(() => setSaveSuccess(false), 3000);
    },
    onError: (err) => {
      setSaveError(err instanceof ApiError ? err.message : 'Erro ao salvar escalação.');
    },
  });

  // ── Derived ────────────────────────────────────────────────────────────────

  const myMember = league?.members.find((m) => m.userId === user?.id);
  const myMembershipId = myMember?.membershipId;
  const myRosterId = myMember?.rosterId;

  const roster = useMemo<RosterPlayer[]>(() => {
    if (!draft || !myMembershipId) return [];
    return [...draft.picks]
      .filter((p) => p.membershipId === myMembershipId)
      .sort(
        (a, b) =>
          POSITION_ORDER[a.player.position] - POSITION_ORDER[b.player.position] ||
          a.player.name.localeCompare(b.player.name),
      )
      .map((p) => ({
        id: p.player.id,
        name: p.player.name,
        position: p.player.position,
        countryCode: p.player.countryCode,
        photoUrl: p.player.photoUrl,
      }));
  }, [draft, myMembershipId]);

  const selectedRound = rounds.find((r) => r.id === selectedRoundId) ?? null;
  const isLocked = selectedRound?.locked ?? false;
  const formationParts = parseFormationParts(formation);

  const starterCountByPos = useMemo<Record<Position, number>>(() => {
    const counts: Record<Position, number> = {
      [Position.GOL]: 0,
      [Position.DEF]: 0,
      [Position.MEI]: 0,
      [Position.ATA]: 0,
    };
    Array.from(starterIds).forEach((pid) => {
      const p = roster.find((r) => r.id === pid);
      if (p) counts[p.position]++;
    });
    return counts;
  }, [starterIds, roster]);

  const myScore = scores?.teams.find((t) => t.rosterId === myRosterId) ?? null;
  const playerScoreMap = useMemo(
    () => new Map((myScore?.playerScores ?? []).map((ps) => [ps.playerId, ps.points])),
    [myScore],
  );

  const breakdownPlayer = roster.find((p) => p.id === breakdownPlayerId) ?? null;
  const breakdownScore =
    myScore?.playerScores.find((ps) => ps.playerId === breakdownPlayerId) ?? null;

  const starterCount = starterIds.size;
  const canSave =
    !isLocked &&
    starterCount === 11 &&
    roster.length - starterCount === 4 &&
    !!captainId &&
    !saveMutation.isPending;

  const countdown = useCountdown(
    selectedRound && !selectedRound.locked ? selectedRound.lockAt : null,
  );

  // ── Effects ────────────────────────────────────────────────────────────────

  // Auto-select current open round (or last round)
  useEffect(() => {
    if (!selectedRoundId && rounds.length > 0) {
      const open = rounds.find((r) => !r.locked) ?? rounds[rounds.length - 1];
      setSelectedRoundId(open.id);
    }
  }, [rounds, selectedRoundId]);

  // Reset form on round switch (fires before lineup data arrives)
  useEffect(() => {
    setStarterIds(new Set());
    setCaptainId(null);
    setSaveError('');
    setSaveSuccess(false);
  }, [selectedRoundId]);

  // Populate form when a saved lineup loads
  useEffect(() => {
    if (!existingLineup) return;
    setFormation(existingLineup.formation);
    setStarterIds(new Set(existingLineup.slots.filter((s) => s.isStarter).map((s) => s.player.id)));
    setCaptainId(existingLineup.captainId);
    setSaveError('');
    setSaveSuccess(false);
    // existingLineup.id is stable per lineup; re-run only when a different lineup loads
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingLineup?.id]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  function canMakeStarter(player: RosterPlayer): boolean {
    if (!formationParts || starterIds.size >= 11) return false;
    return starterCountByPos[player.position] < formationQuota(player.position, formationParts);
  }

  function toggleStarter(player: RosterPlayer) {
    if (isLocked) return;
    if (starterIds.has(player.id)) {
      setStarterIds((prev) => {
        const n = new Set(prev);
        n.delete(player.id);
        return n;
      });
      if (captainId === player.id) setCaptainId(null);
    } else {
      if (!canMakeStarter(player)) return;
      setStarterIds((prev) => new Set(prev).add(player.id));
    }
  }

  function handleFormationChange(f: string) {
    if (isLocked) return;
    const parts = parseFormationParts(f);
    if (!parts) return;
    // Trim starters that exceed the new formation limits
    const byPos: Record<Position, string[]> = {
      [Position.GOL]: [],
      [Position.DEF]: [],
      [Position.MEI]: [],
      [Position.ATA]: [],
    };
    Array.from(starterIds).forEach((pid) => {
      const p = roster.find((r) => r.id === pid);
      if (p) byPos[p.position].push(pid);
    });
    const keep = new Set<string>([
      ...byPos[Position.GOL].slice(0, 1),
      ...byPos[Position.DEF].slice(0, parts.def),
      ...byPos[Position.MEI].slice(0, parts.mei),
      ...byPos[Position.ATA].slice(0, parts.ata),
    ]);
    setFormation(f);
    setStarterIds(keep);
    if (captainId && !keep.has(captainId)) setCaptainId(null);
  }

  function buildSlots(): Array<{ playerId: string; slotIndex: number; isStarter: boolean }> {
    const starters = roster
      .filter((p) => starterIds.has(p.id))
      .sort((a, b) => POSITION_ORDER[a.position] - POSITION_ORDER[b.position]);
    const subs = roster.filter((p) => !starterIds.has(p.id));
    return [...starters, ...subs].map((p, i) => ({
      playerId: p.id,
      slotIndex: i + 1,
      isStarter: starterIds.has(p.id),
    }));
  }

  function handleSave() {
    if (!canSave || !captainId) return;
    saveMutation.mutate({ formation, captainId, slots: buildSlots() });
  }

  // ── Early returns ──────────────────────────────────────────────────────────

  if (roundsLoading && !rounds.length) return <LineupSkeleton />;

  if (draft && draft.status !== DraftStatus.COMPLETED) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <p className="font-display text-5xl text-text-secondary">DRAFT NÃO CONCLUÍDO</p>
        <p className="text-sm text-text-secondary">Complete o draft antes de montar a escalação.</p>
        <Link
          href={`/leagues/${leagueId}/draft`}
          className="cursor-pointer text-amber-400 transition-colors duration-150 hover:text-amber-300"
        >
          Ir para o Draft →
        </Link>
      </div>
    );
  }

  if (!roundsLoading && !rounds.length) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <p className="font-display text-5xl text-text-secondary">SEM RODADAS</p>
        <p className="text-sm text-text-secondary">O dono da liga ainda não criou rodadas.</p>
        <Link
          href={`/leagues/${leagueId}`}
          className="cursor-pointer text-amber-400 transition-colors duration-150 hover:text-amber-300"
        >
          ← Voltar para a liga
        </Link>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 pb-28">
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href={`/leagues/${leagueId}`}
            className="mb-1 inline-flex cursor-pointer items-center gap-1 text-xs text-text-secondary transition-colors duration-150 hover:text-amber-400"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3 w-3"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
            {league?.name ?? 'Liga'}
          </Link>
          <h1 className="font-display text-4xl text-text-primary">ESCALAÇÃO</h1>
        </div>

        <select
          value={selectedRoundId ?? ''}
          onChange={(e) => setSelectedRoundId(e.target.value)}
          className="cursor-pointer self-start rounded border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-primary outline-none transition-colors duration-200 focus:border-amber-500/50 sm:self-auto"
        >
          {rounds.map((r) => (
            <option key={r.id} value={r.id}>
              {STAGE_LABEL[r.stage] ?? r.stage}
              {r.locked ? ' (travada)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* ── Round status ─────────────────────────────────────────────────────── */}
      {selectedRound && (
        <div
          className={cn(
            'flex items-center justify-between rounded-lg border px-4 py-3',
            isLocked
              ? 'border-red-500/30 bg-red-500/[0.05]'
              : countdown
                ? 'border-amber-500/40 bg-amber-500/[0.05]'
                : 'border-border bg-surface',
          )}
        >
          <div className="flex items-center gap-2">
            {isLocked ? (
              <>
                <LockIcon className="h-4 w-4 shrink-0 text-red-400" />
                <span className="text-sm font-semibold text-red-400">Escalação travada</span>
              </>
            ) : (
              <>
                <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-400">Aberta para edição</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            {!isLocked && countdown && (
              <div className="flex items-center gap-1.5">
                <ClockIcon className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs font-bold tracking-widest text-amber-400">
                  TRAVA EM {countdown}
                </span>
              </div>
            )}
            {!isLocked && !lineupLoading && !existingLineup && (
              <span className="rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                Sem escalação
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Score summary ─────────────────────────────────────────────────────── */}
      {myScore && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/[0.05] px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/70">
              Pontuação da Rodada
            </p>
            <p className="font-display text-6xl leading-none text-emerald-400">
              {(myScore.totalPoints / 10).toFixed(1)}
            </p>
          </div>
          <span className="text-xs text-text-secondary">pts</span>
        </div>
      )}

      {/* ── Formation picker ──────────────────────────────────────────────────── */}
      {roster.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-text-secondary">
            Formação
          </p>
          <div className="flex flex-wrap gap-2">
            {VALID_FORMATIONS.map((f) => (
              <button
                key={f}
                onClick={() => handleFormationChange(f)}
                disabled={isLocked}
                className={cn(
                  'rounded px-3 py-1.5 text-sm font-bold tracking-wide transition-all duration-200',
                  formation === f
                    ? 'bg-amber-500 text-background shadow-[0_0_16px_rgba(245,158,11,0.35)]'
                    : isLocked
                      ? 'border border-border text-text-secondary opacity-50'
                      : 'cursor-pointer border border-border text-text-secondary hover:border-amber-500/50 hover:text-text-primary',
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Mobile tabs ───────────────────────────────────────────────────────── */}
      {roster.length > 0 && (
        <div className="flex gap-1 rounded-lg border border-border bg-surface p-1 lg:hidden">
          {(['field', 'roster'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className={cn(
                'flex-1 cursor-pointer rounded px-3 py-2 text-sm font-semibold transition-colors duration-200',
                mobileTab === tab
                  ? 'bg-amber-500 text-background'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {tab === 'field' ? `Campo (${starterCount}/11)` : `Elenco (${roster.length})`}
            </button>
          ))}
        </div>
      )}

      {/* ── Main grid ─────────────────────────────────────────────────────────── */}
      {roster.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-5">
          <div className={cn('lg:col-span-3', mobileTab !== 'field' && 'hidden lg:block')}>
            <PitchView
              roster={roster}
              formationParts={formationParts}
              starterIds={starterIds}
              captainId={captainId}
              isLocked={isLocked}
              playerScoreMap={playerScoreMap}
              onToggleCaptain={(pid) => !isLocked && setCaptainId((p) => (p === pid ? null : pid))}
              onOpenBreakdown={setBreakdownPlayerId}
            />
          </div>

          <div className={cn('lg:col-span-2', mobileTab !== 'roster' && 'hidden lg:block')}>
            <RosterPanel
              roster={roster}
              formationParts={formationParts}
              starterIds={starterIds}
              captainId={captainId}
              isLocked={isLocked}
              starterCountByPos={starterCountByPos}
              playerScoreMap={playerScoreMap}
              canMakeStarter={canMakeStarter}
              onToggleStarter={toggleStarter}
              onSetCaptain={(pid) => !isLocked && setCaptainId((p) => (p === pid ? null : pid))}
            />
          </div>
        </div>
      )}

      {/* ── No roster ─────────────────────────────────────────────────────────── */}
      {roster.length === 0 && !roundsLoading && (
        <div className="py-16 text-center">
          <p className="text-text-secondary">Elenco não disponível. O draft foi concluído?</p>
        </div>
      )}

      {/* ── Locked + no lineup ────────────────────────────────────────────────── */}
      {isLocked && !lineupLoading && !existingLineup && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/[0.05] px-5 py-8 text-center">
          <p className="font-display text-4xl text-red-400">ESCALAÇÃO NÃO ENVIADA</p>
          <p className="mt-2 text-sm text-text-secondary">
            Nenhuma escalação foi submetida antes do encerramento desta rodada.
          </p>
        </div>
      )}

      {/* ── Sticky save bar ───────────────────────────────────────────────────── */}
      {!isLocked && roster.length > 0 && (
        <div className="fixed inset-x-0 bottom-16 z-20 border-t border-border bg-background/95 backdrop-blur-sm md:bottom-0">
          <div className="mx-auto max-w-6xl px-4 py-3">
            {saveError && (
              <div className="mb-2 flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/[0.08] px-4 py-2.5">
                <WarningIcon className="h-4 w-4 shrink-0 text-red-400" />
                <p className="flex-1 text-sm font-semibold text-red-400">{saveError}</p>
                <button
                  onClick={() => setSaveError('')}
                  aria-label="Fechar erro"
                  className="cursor-pointer text-red-400/60 transition-colors hover:text-red-400"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            )}
            {saveSuccess && (
              <div className="mb-2 flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.08] px-4 py-2.5">
                <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-400" />
                <p className="text-sm font-semibold text-emerald-400">
                  Escalação salva com sucesso!
                </p>
              </div>
            )}

            <div className="flex items-center gap-4">
              <div className="flex flex-1 flex-wrap gap-x-4">
                <span
                  className={cn(
                    'text-xs font-semibold',
                    starterCount === 11 ? 'text-emerald-400' : 'text-text-secondary',
                  )}
                >
                  {starterCount}/11 titulares
                </span>
                <span
                  className={cn(
                    'text-xs font-semibold',
                    captainId ? 'text-amber-400' : 'text-text-secondary',
                  )}
                >
                  {captainId ? '★ Capitão definido' : 'Sem capitão'}
                </span>
              </div>
              <button
                onClick={handleSave}
                disabled={!canSave}
                className={cn(
                  'shrink-0 rounded px-6 py-2.5 text-sm font-bold transition-all duration-200',
                  canSave
                    ? 'cursor-pointer bg-amber-500 text-background shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:bg-amber-400'
                    : 'cursor-not-allowed bg-surface-2 text-text-secondary opacity-50',
                )}
              >
                {saveMutation.isPending ? 'Salvando...' : 'Salvar Escalação'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Player breakdown drawer ──────────────────────────────────────────── */}
      {breakdownPlayer && (
        <PlayerBreakdownDrawer
          player={breakdownPlayer}
          isCaptain={captainId === breakdownPlayer.id}
          score={breakdownScore}
          onClose={() => setBreakdownPlayerId(null)}
        />
      )}
    </div>
  );
}

// ─── PitchView ────────────────────────────────────────────────────────────────

interface PitchViewProps {
  roster: RosterPlayer[];
  formationParts: { def: number; mei: number; ata: number } | null;
  starterIds: Set<string>;
  captainId: string | null;
  isLocked: boolean;
  playerScoreMap: Map<string, number>;
  onToggleCaptain: (pid: string) => void;
  onOpenBreakdown: (playerId: string) => void;
}

function PitchView({
  roster,
  formationParts,
  starterIds,
  captainId,
  isLocked,
  playerScoreMap,
  onToggleCaptain,
  onOpenBreakdown,
}: PitchViewProps) {
  if (!formationParts) return null;
  const { def, mei, ata } = formationParts;

  const byPos: Record<Position, RosterPlayer[]> = {
    [Position.GOL]: [],
    [Position.DEF]: [],
    [Position.MEI]: [],
    [Position.ATA]: [],
  };
  for (const p of roster) {
    if (starterIds.has(p.id)) byPos[p.position].push(p);
  }

  const subs = roster.filter((p) => !starterIds.has(p.id));

  function Row({ players, slots, pos }: { players: RosterPlayer[]; slots: number; pos: Position }) {
    return (
      <div className="flex justify-center gap-1.5 sm:gap-3">
        {players.map((p) => (
          <PitchCard
            key={p.id}
            player={p}
            isCaptain={captainId === p.id}
            isLocked={isLocked}
            score={playerScoreMap.get(p.id)}
            onToggleCaptain={() => onToggleCaptain(p.id)}
            onOpenBreakdown={() => onOpenBreakdown(p.id)}
          />
        ))}
        {Array.from({ length: slots - players.length }).map((_, i) => (
          <EmptySlot key={i} pos={pos} />
        ))}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      {/* Pitch */}
      <div
        className="relative"
        style={{ background: 'linear-gradient(180deg, #071a07 0%, #0d2a0d 50%, #071a07 100%)' }}
      >
        {/* Markings */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute left-0 right-0 top-1/2 h-px bg-white/[0.04]" />
          <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.04]" />
          <div className="absolute bottom-0 left-1/2 h-12 w-40 -translate-x-1/2 border border-white/[0.04] border-b-0" />
          <div className="absolute top-0 left-1/2 h-12 w-40 -translate-x-1/2 border border-white/[0.04] border-t-0" />
        </div>

        {/* Rows top→bottom: ATA MEI DEF GOL */}
        <div className="relative flex flex-col gap-5 px-3 py-6">
          {[
            { pos: Position.ATA, slots: ata },
            { pos: Position.MEI, slots: mei },
            { pos: Position.DEF, slots: def },
            { pos: Position.GOL, slots: 1 },
          ].map(({ pos, slots }) => (
            <div key={pos} className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  'text-[9px] font-bold uppercase tracking-widest opacity-50',
                  POSITION_TEXT[pos],
                )}
              >
                {pos}
              </span>
              <Row players={byPos[pos]} slots={slots} pos={pos} />
            </div>
          ))}
        </div>
      </div>

      {/* Subs strip */}
      <div className="border-t border-border bg-surface px-4 py-3">
        <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-text-secondary">
          Reservas ({subs.length}/4)
        </p>
        <div className="flex flex-wrap gap-1.5">
          {subs.length === 0 && <span className="text-xs text-text-secondary">Nenhum</span>}
          {subs.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-1 rounded border border-border bg-surface-2 px-2 py-1"
            >
              <span className={cn('text-[9px] font-bold', POSITION_TEXT[p.position])}>
                {p.position}
              </span>
              <span className="max-w-[80px] truncate text-[11px] text-text-secondary">
                {lastName(p.name)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PitchCard({
  player,
  isCaptain,
  isLocked,
  score,
  onToggleCaptain,
  onOpenBreakdown,
}: {
  player: RosterPlayer;
  isCaptain: boolean;
  isLocked: boolean;
  score?: number;
  onToggleCaptain: () => void;
  onOpenBreakdown: () => void;
}) {
  return (
    <div
      onClick={onOpenBreakdown}
      role="button"
      aria-label={`Ver detalhe de pontuação de ${player.name}`}
      className="flex w-[52px] cursor-pointer flex-col items-center gap-0.5 sm:w-[60px]"
    >
      <div
        onClick={
          !isLocked
            ? (e) => {
                e.stopPropagation();
                onToggleCaptain();
              }
            : undefined
        }
        role={!isLocked ? 'button' : undefined}
        aria-label={
          !isLocked ? (isCaptain ? 'Remover capitão' : 'Definir como capitão') : undefined
        }
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-200',
          isCaptain
            ? 'border-amber-500 bg-amber-500/20 shadow-[0_0_14px_rgba(245,158,11,0.5)]'
            : 'border-white/20 bg-white/10',
          !isLocked && 'cursor-pointer hover:border-amber-500/60',
        )}
      >
        {isCaptain ? (
          <span className="text-sm font-bold text-amber-400">C</span>
        ) : (
          <span className={cn('text-[10px] font-bold', POSITION_TEXT[player.position])}>
            {player.countryCode.slice(0, 3)}
          </span>
        )}
      </div>
      <p className="max-w-full truncate text-center text-[10px] font-semibold leading-tight text-white/90">
        {lastName(player.name)}
      </p>
      {score !== undefined && (
        <span
          className={cn(
            'rounded px-1 py-0.5 text-[9px] font-bold leading-none',
            isCaptain ? 'bg-amber-500/30 text-amber-400' : 'bg-emerald-500/20 text-emerald-400',
          )}
        >
          {(score / 10).toFixed(1)}
          {isCaptain ? '×2' : ''}
        </span>
      )}
    </div>
  );
}

function EmptySlot({ pos }: { pos: Position }) {
  return (
    <div className="flex w-[52px] flex-col items-center gap-0.5 sm:w-[60px]">
      <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-white/10">
        <span className={cn('text-[9px] font-bold opacity-40', POSITION_TEXT[pos])}>{pos[0]}</span>
      </div>
      <div className="h-2.5 w-8 rounded-full bg-white/5" />
    </div>
  );
}

// ─── PlayerBreakdownDrawer ────────────────────────────────────────────────────

function PlayerBreakdownDrawer({
  player,
  isCaptain,
  score,
  onClose,
}: {
  player: RosterPlayer;
  isCaptain: boolean;
  score: PlayerScore | null;
  onClose: () => void;
}) {
  const items = score
    ? BREAKDOWN_LABELS.filter(({ key }) => (score.breakdown[key] ?? 0) !== 0)
    : [];

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative w-full max-w-md rounded-t-xl border border-border bg-surface shadow-2xl sm:rounded-xl">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border px-5 py-4">
          <span
            className={cn(
              'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold',
              POSITION_CHIP[player.position],
            )}
          >
            {player.position}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold leading-tight text-text-primary">
              {player.name}
            </p>
            <p className="text-[11px] text-text-secondary">{player.countryCode}</p>
          </div>
          {isCaptain && (
            <span className="shrink-0 rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
              ★ Capitão
            </span>
          )}
          <button
            onClick={onClose}
            aria-label="Fechar detalhe"
            className="shrink-0 cursor-pointer rounded p-1 text-text-secondary transition-colors duration-150 hover:text-text-primary"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          {!score ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <ClockIcon className="h-6 w-6 text-text-secondary" />
              <p className="text-sm font-semibold text-text-secondary">
                Rodada ainda não pontuada.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                {items.length === 0 && (
                  <p className="text-sm text-text-secondary">Sem eventos pontuados nesta rodada.</p>
                )}
                {items.map(({ key, label }) => {
                  const value = score.breakdown[key];
                  return (
                    <div key={key} className="flex items-center justify-between text-sm">
                      <span className="text-text-secondary">{label}</span>
                      <span
                        className={cn(
                          'font-semibold tabular-nums',
                          value > 0
                            ? 'text-emerald-400'
                            : value < 0
                              ? 'text-red-400'
                              : 'text-text-secondary',
                        )}
                      >
                        {formatSigned(value)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-border pt-3">
                {isCaptain && (
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="text-text-secondary">Subtotal</span>
                    <span className="font-semibold tabular-nums text-text-secondary">
                      {formatSigned(score.breakdown.subtotal ?? 0)}
                    </span>
                  </div>
                )}
                {isCaptain && (
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-semibold uppercase tracking-wider text-amber-400">
                      Capitão ×2
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold uppercase tracking-wider text-text-primary">
                    Total
                  </span>
                  <span
                    className={cn(
                      'font-display text-3xl leading-none',
                      isCaptain ? 'text-amber-400' : 'text-emerald-400',
                    )}
                  >
                    {formatPoints(score.points)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── RosterPanel ──────────────────────────────────────────────────────────────

interface RosterPanelProps {
  roster: RosterPlayer[];
  formationParts: { def: number; mei: number; ata: number } | null;
  starterIds: Set<string>;
  captainId: string | null;
  isLocked: boolean;
  starterCountByPos: Record<Position, number>;
  playerScoreMap: Map<string, number>;
  canMakeStarter: (p: RosterPlayer) => boolean;
  onToggleStarter: (p: RosterPlayer) => void;
  onSetCaptain: (pid: string) => void;
}

function RosterPanel({
  roster,
  formationParts,
  starterIds,
  captainId,
  isLocked,
  starterCountByPos,
  playerScoreMap,
  canMakeStarter,
  onToggleStarter,
  onSetCaptain,
}: RosterPanelProps) {
  return (
    <div className="space-y-4">
      {([Position.GOL, Position.DEF, Position.MEI, Position.ATA] as Position[]).map((pos) => {
        const posPlayers = roster.filter((p) => p.position === pos);
        const quota = formationQuota(pos, formationParts);
        const filled = starterCountByPos[pos];

        return (
          <div key={pos}>
            {/* Position header with mini progress bar */}
            <div className="mb-1.5 flex items-center gap-2">
              <span
                className={cn(
                  'text-[10px] font-bold uppercase tracking-widest',
                  POSITION_TEXT[pos],
                )}
              >
                {pos}
              </span>
              <span className="text-[10px] text-text-secondary">
                {filled}/{quota}
              </span>
              <div className="ml-auto h-1 w-16 overflow-hidden rounded-full bg-border">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-300',
                    filled === quota ? 'bg-emerald-500' : 'bg-amber-500',
                  )}
                  style={{ width: quota > 0 ? `${(filled / quota) * 100}%` : '0%' }}
                />
              </div>
            </div>

            <div className="space-y-1">
              {posPlayers.map((player) => {
                const isStarter = starterIds.has(player.id);
                const isCaptain = captainId === player.id;
                const eligible = canMakeStarter(player);
                const score = playerScoreMap.get(player.id);

                return (
                  <div
                    key={player.id}
                    onClick={() => onToggleStarter(player)}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg border px-3 py-2 transition-all duration-150',
                      isStarter
                        ? isCaptain
                          ? 'border-amber-500/50 bg-amber-500/[0.08]'
                          : 'border-sky-500/30 bg-sky-500/[0.05]'
                        : 'border-border bg-surface',
                      !isLocked && (isStarter || eligible) && 'cursor-pointer',
                      !isLocked && !isStarter && !eligible && 'opacity-40',
                    )}
                  >
                    <span
                      className={cn(
                        'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold',
                        POSITION_CHIP[player.position],
                      )}
                    >
                      {player.position}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold leading-tight text-text-primary">
                        {player.name}
                      </p>
                      <p className="text-[10px] text-text-secondary">{player.countryCode}</p>
                    </div>

                    {score !== undefined && (
                      <span
                        className={cn(
                          'shrink-0 text-xs font-bold',
                          isCaptain ? 'text-amber-400' : 'text-emerald-400',
                        )}
                      >
                        {(score / 10).toFixed(1)}
                        {isCaptain && '×2'}
                      </span>
                    )}

                    <div className="flex shrink-0 items-center gap-1.5">
                      {isStarter ? (
                        <>
                          <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-sky-400">
                            Titular
                          </span>
                          {!isLocked && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onSetCaptain(player.id);
                              }}
                              aria-label={isCaptain ? 'Remover capitão' : 'Definir capitão'}
                              className={cn(
                                'cursor-pointer rounded px-1.5 py-0.5 text-[9px] font-bold uppercase transition-colors duration-150',
                                isCaptain
                                  ? 'bg-amber-500 text-background'
                                  : 'border border-border text-text-secondary hover:border-amber-500/50 hover:text-amber-400',
                              )}
                            >
                              C
                            </button>
                          )}
                          {isLocked && isCaptain && (
                            <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold uppercase text-background">
                              Cap
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[9px] font-bold uppercase text-text-secondary">
                          Reserva
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function LineupSkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="flex items-center justify-between">
        <div className="h-10 w-40 rounded-lg bg-surface" />
        <div className="h-9 w-32 rounded bg-surface" />
      </div>
      <div className="h-12 rounded-lg bg-surface" />
      <div className="h-9 w-72 rounded-lg bg-surface" />
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="h-[420px] rounded-xl bg-surface lg:col-span-3" />
        <div className="space-y-1.5 lg:col-span-2">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="h-11 rounded-lg bg-surface" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Inline icon components (SVG — no emoji) ──────────────────────────────────

function LockIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}
