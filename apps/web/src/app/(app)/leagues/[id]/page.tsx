'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DraftStatus } from '@wcf/shared';
import { useAuthStore } from '@/store/auth.store';
import { api } from '@/lib/api';
import type { LeagueResponseDto } from '../types';

export default function LeagueLobbyPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken, user } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: league, isLoading } = useQuery<LeagueResponseDto>({
    queryKey: ['league', id],
    queryFn: () => api.get<LeagueResponseDto>(`/leagues/${id}`, accessToken ?? undefined),
    enabled: !!accessToken && !!id,
  });

  const drawMutation = useMutation({
    mutationFn: () => api.post(`/leagues/${id}/draw`, {}, accessToken ?? undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['league', id] }),
  });

  const startMutation = useMutation({
    mutationFn: () => api.post(`/leagues/${id}/draft/start`, {}, accessToken ?? undefined),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['league', id] }),
  });

  if (isLoading) {
    return <p className="text-text-secondary">Carregando...</p>;
  }

  if (!league) return null;

  const isOwner = league.ownerId === user?.id;
  const draftStarted = league.draftStatus === DraftStatus.IN_PROGRESS;
  const draftDone = league.draftStatus === DraftStatus.COMPLETED;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-5xl text-text-primary">{league.name}</h1>
          <p className="mt-1 font-body text-sm text-text-secondary">
            {league.memberCount}/{league.maxTeams} times •{' '}
            <span className="font-semibold text-amber-400 tracking-widest">
              {league.inviteCode}
            </span>
          </p>
        </div>

        <div className="flex gap-3">
          {draftStarted && (
            <Link
              href={`/leagues/${id}/draft`}
              className="rounded bg-emerald-500 px-5 py-2 font-body font-semibold text-background hover:bg-emerald-400"
            >
              Ir para o Draft →
            </Link>
          )}

          {isOwner && !league.draftStatus && (
            <button
              onClick={() => drawMutation.mutate()}
              disabled={drawMutation.isPending || league.memberCount < 2}
              className="rounded border border-border px-5 py-2 font-body text-sm font-semibold text-text-secondary transition-colors hover:border-amber-500 hover:text-amber-400 disabled:opacity-50"
            >
              {drawMutation.isPending ? 'Sorteando...' : 'Sortear ordem'}
            </button>
          )}

          {isOwner && league.draftStatus === DraftStatus.PENDING && (
            <button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              className="rounded bg-amber-500 px-5 py-2 font-body text-sm font-semibold text-background transition-colors hover:bg-amber-400 disabled:opacity-50"
            >
              {startMutation.isPending ? 'Iniciando...' : '▶ Iniciar Draft'}
            </button>
          )}
        </div>
      </div>

      {/* Members */}
      <div>
        <h2 className="mb-4 font-display text-2xl text-text-secondary">TIMES</h2>
        <div className="divide-y divide-border rounded border border-border bg-surface">
          {league.members.map((member, idx) => (
            <div key={member.membershipId} className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="font-body font-semibold text-text-primary">{member.teamName}</p>
                <p className="text-sm text-text-secondary">@{member.username}</p>
              </div>
              <div className="flex items-center gap-3">
                {league.ownerId === member.userId && (
                  <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs text-amber-400">
                    owner
                  </span>
                )}
                <span className="font-display text-lg text-text-secondary">#{idx + 1}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Status message */}
      {draftDone && (
        <p className="text-center text-sm text-emerald-400">
          Draft concluído. Veja a classificação.
        </p>
      )}

      {league.memberCount < 2 && isOwner && (
        <p className="rounded border border-border bg-surface px-5 py-4 text-sm text-text-secondary">
          Compartilhe o código{' '}
          <span className="font-semibold tracking-widest text-amber-400">{league.inviteCode}</span>{' '}
          com seus amigos para começar.
        </p>
      )}
    </div>
  );
}
