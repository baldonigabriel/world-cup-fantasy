'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DraftStatus, Position, ROSTER_QUOTAS } from '@wcf/shared';
import { useAuthStore } from '@/store/auth.store';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { PlayerCard } from '@/components/draft/PlayerCard';
import { RosterProgress } from '@/components/draft/RosterProgress';
import type { LeagueResponseDto } from '../../types';

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
  photoUrl: string | null;
  country: { id: string; name: string; code: string; flagUrl: string | null };
}

const POSITION_TABS = [null, Position.GOL, Position.DEF, Position.MEI, Position.ATA] as const;
type PositionTab = (typeof POSITION_TABS)[number];

export default function DraftRoomPage() {
  const { id: leagueId } = useParams<{ id: string }>();
  const { accessToken, user } = useAuthStore();
  const queryClient = useQueryClient();

  const [posFilter, setPosFilter] = useState<PositionTab>(null);
  const [pickError, setPickError] = useState('');

  const { data: league } = useQuery<LeagueResponseDto>({
    queryKey: ['league', leagueId],
    queryFn: () => api.get<LeagueResponseDto>(`/leagues/${leagueId}`, accessToken ?? undefined),
    enabled: !!accessToken,
  });

  const { data: draft } = useQuery<DraftState>({
    queryKey: ['draft', leagueId],
    queryFn: () => api.get<DraftState>(`/leagues/${leagueId}/draft`, accessToken ?? undefined),
    enabled: !!accessToken,
    refetchInterval: 5000,
  });

  const { data: pool = [] } = useQuery<PoolPlayer[]>({
    queryKey: ['players', leagueId, posFilter],
    queryFn: () =>
      api.get<PoolPlayer[]>(
        `/players?leagueId=${leagueId}${posFilter ? `&position=${posFilter}` : ''}&limit=100`,
        accessToken ?? undefined,
      ),
    enabled: !!accessToken && draft?.status === DraftStatus.IN_PROGRESS,
    refetchInterval: 5000,
  });

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

  const myMembershipId = league?.members.find((m) => m.userId === user?.id)?.membershipId;
  const isMyTurn = !!myMembershipId && draft?.nextMembershipId === myMembershipId;

  const myPicks = draft?.picks.filter((p) => p.membershipId === myMembershipId) ?? [];

  const round = draft ? Math.floor(draft.currentPick / (draft.order.length || 1)) + 1 : 0;
  const pickInRound = draft ? (draft.currentPick % (draft.order.length || 1)) + 1 : 0;

  const nextTeamName = draft?.nextMembershipId
    ? league?.members.find((m) => m.membershipId === draft.nextMembershipId)?.teamName
    : null;

  if (!draft) {
    return <p className="text-text-secondary">Carregando draft...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div
        className={cn(
          'rounded border p-5',
          isMyTurn ? 'border-amber-500 bg-amber-500/10' : 'border-border bg-surface',
        )}
      >
        {draft.status === DraftStatus.COMPLETED ? (
          <p className="font-display text-3xl text-emerald-400">DRAFT CONCLUÍDO</p>
        ) : (
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-display text-3xl text-text-primary">
                RODADA {round} · PICK {pickInRound}
              </p>
              <p className="text-sm text-text-secondary">
                Pick global {draft.currentPick + 1} de {draft.totalPicks}
              </p>
            </div>
            <div className="text-right">
              {isMyTurn ? (
                <p className="font-display text-2xl text-amber-400">SUA VEZ!</p>
              ) : (
                <p className="text-sm text-text-secondary">
                  Vez de <span className="font-semibold text-text-primary">{nextTeamName}</span>
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Player pool */}
        <div className="space-y-4 lg:col-span-2">
          <div className="flex gap-2 overflow-x-auto">
            {POSITION_TABS.map((pos) => (
              <button
                key={pos ?? 'all'}
                onClick={() => setPosFilter(pos)}
                className={cn(
                  'whitespace-nowrap rounded px-4 py-1.5 text-sm font-semibold transition-colors',
                  posFilter === pos
                    ? 'bg-amber-500 text-background'
                    : 'border border-border text-text-secondary hover:border-amber-500 hover:text-amber-400',
                )}
              >
                {pos ?? 'Todos'}
              </button>
            ))}
          </div>

          {pickError && <p className="text-sm text-red-400">{pickError}</p>}

          <div className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {pool.length === 0 && (
              <p className="py-8 text-center text-text-secondary">Nenhum jogador disponível.</p>
            )}
            {pool.map((p) => (
              <PlayerCard
                key={p.id}
                id={p.id}
                name={p.name}
                position={p.position}
                countryCode={p.country.code}
                countryName={p.country.name}
                photoUrl={p.photoUrl}
                isMyTurn={isMyTurn}
                onPick={(pid) => pickMutation.mutate(pid)}
                isPicking={pickMutation.isPending}
              />
            ))}
          </div>
        </div>

        {/* Sidebar: my roster progress */}
        <div className="space-y-6">
          <div className="rounded border border-border bg-surface p-5">
            <h3 className="mb-4 font-display text-xl text-text-secondary">MEU ELENCO</h3>
            <RosterProgress
              picks={myPicks.map((p) => ({
                player: {
                  position: p.player.position,
                  name: p.player.name,
                  countryCode: p.player.countryCode,
                },
              }))}
            />
            <p className="mt-3 text-right text-sm text-text-secondary">
              {myPicks.length} / {Object.values(ROSTER_QUOTAS).reduce((a, b) => a + b, 0)} jogadores
            </p>
          </div>

          {/* Last picks log */}
          <div className="rounded border border-border bg-surface p-5">
            <h3 className="mb-3 font-display text-xl text-text-secondary">ÚLTIMAS ESCOLHAS</h3>
            <div className="space-y-2">
              {draft.picks
                .slice(-8)
                .reverse()
                .map((pick) => {
                  const teamName = league?.members.find(
                    (m) => m.membershipId === pick.membershipId,
                  )?.teamName;
                  return (
                    <div key={pick.pickIndex} className="flex items-center justify-between text-sm">
                      <span className="text-text-primary">{pick.player.name}</span>
                      <span className="text-text-secondary">{teamName}</span>
                    </div>
                  );
                })}
              {draft.picks.length === 0 && (
                <p className="text-sm text-text-secondary">Nenhuma escolha ainda.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
