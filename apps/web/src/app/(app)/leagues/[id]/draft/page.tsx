'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DraftStatus, Position, ROSTER_QUOTAS } from '@wcf/shared';
import { useAuthStore } from '@/store/auth.store';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { PlayerCard } from '@/components/draft/PlayerCard';
import { RosterProgress } from '@/components/draft/RosterProgress';
import { SnakeOrderStrip } from '@/components/draft/SnakeOrderStrip';
import type { LeagueResponseDto } from '../../types';

// ─── Local types ──────────────────────────────────────────────────────────────

interface DraftPickPlayer {
  id: string;
  name: string;
  position: Position;
  photoUrl: string | null;
  countryName: string;
  countryCode: string;
}

interface DraftPick {
  pickIndex: number;
  membershipId: string;
  player: DraftPickPlayer;
  pickedAt: string;
}

interface DraftState {
  status: DraftStatus;
  currentPick: number;
  totalPicks: number;
  nextMembershipId: string | null;
  order: string[];
  picks: DraftPick[];
}

interface PoolPlayer {
  id: string;
  name: string;
  position: Position;
  country: { id: string; name: string; code: string; flagUrl: string | null };
}

const POSITION_TABS = [null, Position.GOL, Position.DEF, Position.MEI, Position.ATA] as const;
type PositionFilter = (typeof POSITION_TABS)[number];
type MobileTab = 'pool' | 'roster' | 'history';

const POSITION_BADGE_CLASS: Record<Position, string> = {
  [Position.GOL]: 'bg-amber-500/20 text-amber-400',
  [Position.DEF]: 'bg-sky-500/20 text-sky-400',
  [Position.MEI]: 'bg-emerald-500/20 text-emerald-400',
  [Position.ATA]: 'bg-red-500/20 text-red-400',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DraftRoomPage() {
  const { id: leagueId } = useParams<{ id: string }>();
  const { accessToken, user } = useAuthStore();
  const queryClient = useQueryClient();

  const [posFilter, setPosFilter] = useState<PositionFilter>(null);
  const [countryFilter, setCountryFilter] = useState('');
  const [pickError, setPickError] = useState('');
  const [mobileTab, setMobileTab] = useState<MobileTab>('pool');

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: league } = useQuery<LeagueResponseDto>({
    queryKey: ['league', leagueId],
    queryFn: () => api.get<LeagueResponseDto>(`/leagues/${leagueId}`, accessToken ?? undefined),
    enabled: !!accessToken,
  });

  const { data: draft, isLoading: draftLoading } = useQuery<DraftState>({
    queryKey: ['draft', leagueId],
    queryFn: () => api.get<DraftState>(`/leagues/${leagueId}/draft`, accessToken ?? undefined),
    enabled: !!accessToken,
    refetchInterval: (query) =>
      query.state.data?.status === DraftStatus.IN_PROGRESS ? 5000 : false,
  });

  const { data: pool = [] } = useQuery<PoolPlayer[]>({
    queryKey: ['players', leagueId, posFilter],
    queryFn: () =>
      api.get<PoolPlayer[]>(
        `/players?leagueId=${leagueId}${posFilter ? `&position=${posFilter}` : ''}&limit=200`,
        accessToken ?? undefined,
      ),
    enabled: !!accessToken && draft?.status === DraftStatus.IN_PROGRESS,
    refetchInterval: 6000,
  });

  // ── Mutation ──────────────────────────────────────────────────────────────────

  const pickMutation = useMutation({
    mutationFn: (playerId: string) =>
      api.post<DraftState>(
        `/leagues/${leagueId}/draft/pick`,
        { playerId },
        accessToken ?? undefined,
      ),
    onSuccess: () => {
      setPickError('');
      queryClient.invalidateQueries({ queryKey: ['draft', leagueId] });
      queryClient.invalidateQueries({ queryKey: ['players', leagueId] });
    },
    onError: (err) => {
      setPickError(err instanceof ApiError ? err.message : 'Erro ao escolher jogador.');
    },
  });

  // ── Derived state ─────────────────────────────────────────────────────────────

  const myMembershipId = league?.members.find((m) => m.userId === user?.id)?.membershipId;
  const isMyTurn = !!myMembershipId && draft?.nextMembershipId === myMembershipId;
  const myPicks = draft?.picks.filter((p) => p.membershipId === myMembershipId) ?? [];

  const myCountrySet = new Set(myPicks.map((p) => p.player.countryCode));
  const myCountByPos = myPicks.reduce<Partial<Record<Position, number>>>((acc, p) => {
    acc[p.player.position] = (acc[p.player.position] ?? 0) + 1;
    return acc;
  }, {});

  function getIneligibleReason(player: PoolPlayer): string | null {
    if ((myCountByPos[player.position] ?? 0) >= ROSTER_QUOTAS[player.position]) {
      return `Quota ${player.position} cheia`;
    }
    if (myCountrySet.has(player.country.code)) {
      return `${player.country.name} já no elenco`;
    }
    return null;
  }

  const countries = Array.from(new Map(pool.map((p) => [p.country.id, p.country])).values()).sort(
    (a, b) => a.name.localeCompare(b.name),
  );

  const filteredPool = pool.filter((p) => countryFilter === '' || p.country.id === countryFilter);

  const getMember = (mid: string) => league?.members.find((m) => m.membershipId === mid);

  const n = draft?.order.length || 1;
  const round = draft ? Math.floor(draft.currentPick / n) + 1 : 0;
  const pickInRound = draft ? (draft.currentPick % n) + 1 : 0;
  const nextTeamName = draft?.nextMembershipId ? getMember(draft.nextMembershipId)?.teamName : null;

  // ── Render ────────────────────────────────────────────────────────────────────

  if (draftLoading) return <DraftSkeleton />;
  if (!draft) return null;

  if (draft.status === DraftStatus.COMPLETED) {
    return <CompletedView draft={draft} getMember={getMember} />;
  }

  return (
    <div className="space-y-5">
      {/* ── Pick header ───────────────────────────────────────────────────── */}
      <div
        className={cn(
          'relative overflow-hidden rounded-lg border p-5 transition-all duration-300',
          isMyTurn
            ? 'border-amber-500 bg-amber-500/[0.06] shadow-[0_0_40px_rgba(245,158,11,0.12)]'
            : 'border-border bg-surface',
        )}
      >
        {isMyTurn && (
          <div className="pointer-events-none absolute inset-0 animate-pulse rounded-lg ring-1 ring-amber-500/20" />
        )}

        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-4xl leading-none text-text-primary">
              RODADA {round} · PICK {pickInRound}
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              Pick global {draft.currentPick + 1} de {draft.totalPicks}
            </p>
          </div>

          <div className="sm:text-right">
            {isMyTurn ? (
              <div>
                <p className="font-display text-3xl leading-none text-amber-400">SUA VEZ!</p>
                <p className="mt-0.5 text-sm text-text-secondary">Escolha um jogador abaixo</p>
              </div>
            ) : (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-text-secondary">
                  Escolhendo agora
                </p>
                <p className="font-display text-2xl text-text-primary">{nextTeamName}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Snake order strip ────────────────────────────────────────────── */}
      {draft.order.length > 0 && (
        <SnakeOrderStrip
          order={draft.order}
          currentPick={draft.currentPick}
          totalPicks={draft.totalPicks}
          nextMembershipId={draft.nextMembershipId}
          getMember={getMember}
          myMembershipId={myMembershipId}
        />
      )}

      {/* ── Pick error ───────────────────────────────────────────────────── */}
      {pickError && (
        <div className="flex items-start gap-3 rounded-lg border border-red-500/30 bg-red-500/8 px-4 py-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="mt-0.5 h-4 w-4 shrink-0 text-red-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-sm font-semibold text-red-400">{pickError}</p>
          <button
            onClick={() => setPickError('')}
            className="ml-auto cursor-pointer shrink-0 text-red-400/60 hover:text-red-400"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Mobile tabs ──────────────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-lg border border-border bg-surface p-1 lg:hidden">
        {(
          [
            { key: 'pool', label: 'Pool' },
            { key: 'roster', label: `Elenco (${myPicks.length})` },
            { key: 'history', label: 'Histórico' },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setMobileTab(key)}
            className={cn(
              'flex-1 cursor-pointer rounded px-3 py-2 text-sm font-semibold transition-colors duration-200',
              mobileTab === key
                ? 'bg-amber-500 text-background'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Main grid ────────────────────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* ── Player pool ───────────────────────────────────────────────── */}
        <div className={cn('space-y-4 lg:col-span-2', mobileTab !== 'pool' && 'hidden lg:block')}>
          {/* Filters */}
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {POSITION_TABS.map((pos) => (
                <button
                  key={pos ?? 'all'}
                  onClick={() => setPosFilter(pos)}
                  className={cn(
                    'cursor-pointer whitespace-nowrap rounded px-3 py-1.5 text-sm font-semibold transition-colors duration-200',
                    posFilter === pos
                      ? 'bg-amber-500 text-background'
                      : 'border border-border text-text-secondary hover:border-amber-500/50 hover:text-text-primary',
                  )}
                >
                  {pos ?? 'Todos'}
                </button>
              ))}
            </div>

            {countries.length > 0 && (
              <select
                value={countryFilter}
                onChange={(e) => setCountryFilter(e.target.value)}
                className="w-full cursor-pointer rounded border border-border bg-surface px-3 py-2 text-sm text-text-secondary outline-none transition-colors duration-200 focus:border-amber-500/50 focus:text-text-primary"
              >
                <option value="">Todas as seleções</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Waiting banner when not my turn */}
          {!isMyTurn && (
            <p className="text-xs text-text-secondary">
              Aguardando <span className="font-semibold text-text-primary">{nextTeamName}</span>{' '}
              escolher — atualizando automaticamente.
            </p>
          )}

          {/* Pool list */}
          <div className="max-h-[62vh] space-y-1.5 overflow-y-auto pr-1">
            {filteredPool.length === 0 && (
              <div className="py-14 text-center">
                <p className="text-text-secondary">Nenhum jogador encontrado.</p>
                {(posFilter || countryFilter) && (
                  <button
                    onClick={() => {
                      setPosFilter(null);
                      setCountryFilter('');
                    }}
                    className="mt-3 cursor-pointer text-sm text-amber-400 hover:text-amber-300"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>
            )}
            {filteredPool.map((p) => {
              const ineligibleReason = getIneligibleReason(p);
              return (
                <PlayerCard
                  key={p.id}
                  id={p.id}
                  name={p.name}
                  position={p.position}
                  countryCode={p.country.code}
                  countryName={p.country.name}
                  isMyTurn={isMyTurn}
                  ineligibleReason={ineligibleReason}
                  onPick={(pid) => {
                    setPickError('');
                    pickMutation.mutate(pid);
                  }}
                  isPicking={pickMutation.isPending}
                />
              );
            })}
          </div>
        </div>

        {/* ── Sidebar ───────────────────────────────────────────────────── */}
        <div className="space-y-5">
          {/* My roster */}
          <div className={cn(mobileTab !== 'roster' && 'hidden lg:block')}>
            <RosterProgress
              picks={myPicks.map((p) => ({
                player: {
                  position: p.player.position,
                  name: p.player.name,
                  countryCode: p.player.countryCode,
                },
              }))}
            />
          </div>

          {/* Last picks log */}
          <div
            className={cn(
              'rounded-lg border border-border bg-surface p-5',
              mobileTab !== 'history' && 'hidden lg:block',
            )}
          >
            <h3 className="mb-4 font-display text-xl text-text-secondary">ÚLTIMAS ESCOLHAS</h3>
            <div className="space-y-1.5">
              {draft.picks.length === 0 ? (
                <p className="text-sm text-text-secondary">Nenhuma escolha ainda.</p>
              ) : (
                [...draft.picks]
                  .reverse()
                  .slice(0, 12)
                  .map((pick) => {
                    const teamName = getMember(pick.membershipId)?.teamName ?? '—';
                    const isMyPick = pick.membershipId === myMembershipId;
                    return (
                      <div
                        key={pick.pickIndex}
                        className={cn(
                          'flex items-center gap-2 rounded px-3 py-2 text-sm',
                          isMyPick ? 'bg-amber-500/10' : 'bg-surface-2',
                        )}
                      >
                        <span
                          className={cn(
                            'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold',
                            POSITION_BADGE_CLASS[pick.player.position],
                          )}
                        >
                          {pick.player.position}
                        </span>
                        <span className="min-w-0 flex-1 truncate font-semibold text-text-primary">
                          {pick.player.name}
                        </span>
                        <span className="shrink-0 text-[10px] text-text-secondary">{teamName}</span>
                      </div>
                    );
                  })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Completed view ───────────────────────────────────────────────────────────

function CompletedView({
  draft,
  getMember,
}: {
  draft: DraftState;
  getMember: (id: string) => { teamName?: string; username?: string } | undefined;
}) {
  const byTeam = draft.order.reduce<Record<string, DraftPick[]>>((acc, mid) => {
    acc[mid] = draft.picks.filter((p) => p.membershipId === mid);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-6 py-8 text-center">
        <p className="font-display text-6xl text-emerald-400">DRAFT CONCLUÍDO</p>
        <p className="mt-2 text-text-secondary">
          Todos os elencos foram formados. Boa sorte na Copa!
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {draft.order.map((mid) => {
          const member = getMember(mid);
          const picks = byTeam[mid] ?? [];

          return (
            <div key={mid} className="rounded-lg border border-border bg-surface p-5">
              <div className="mb-4 border-b border-border pb-3">
                <p className="font-display text-2xl text-text-primary">{member?.teamName ?? '—'}</p>
                <p className="text-xs text-text-secondary">@{member?.username ?? '—'}</p>
              </div>

              <div className="space-y-3">
                {Object.values(Position).map((pos) => {
                  const posPlayers = picks.filter((p) => p.player.position === pos);
                  if (posPlayers.length === 0) return null;
                  return (
                    <div key={pos}>
                      <p
                        className={cn(
                          'mb-1 text-[10px] font-bold uppercase tracking-widest',
                          POSITION_BADGE_CLASS[pos].split(' ')[1],
                        )}
                      >
                        {pos}
                      </p>
                      {posPlayers.map((pick) => (
                        <div key={pick.pickIndex} className="flex items-center gap-1.5 text-sm">
                          <span className="text-[10px] text-text-secondary">
                            {pick.player.countryCode}
                          </span>
                          <span className="truncate text-text-primary">{pick.player.name}</span>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function DraftSkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="h-24 rounded-lg border border-border bg-surface" />
      <div className="h-20 rounded-lg border border-border bg-surface" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-2 lg:col-span-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-14 rounded-lg border border-border bg-surface" />
          ))}
        </div>
        <div className="h-80 rounded-lg border border-border bg-surface" />
      </div>
    </div>
  );
}
