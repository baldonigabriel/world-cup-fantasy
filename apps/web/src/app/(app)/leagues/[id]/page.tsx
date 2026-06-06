'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DraftStatus } from '@wcf/shared';
import { useAuthStore } from '@/store/auth.store';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import { DraftStatusBadge } from '@/components/leagues/DraftStatusBadge';
import type { DraftStateDto, LeagueMemberDto, LeagueResponseDto } from '../types';

export default function LeagueLobbyPage() {
  const { id } = useParams<{ id: string }>();
  const { accessToken, user } = useAuthStore();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data: league, isLoading } = useQuery<LeagueResponseDto>({
    queryKey: ['league', id],
    queryFn: () => api.get<LeagueResponseDto>(`/leagues/${id}`, accessToken ?? undefined),
    enabled: !!accessToken && !!id,
  });

  const { data: draftState } = useQuery<DraftStateDto>({
    queryKey: ['draft', id],
    queryFn: () => api.get<DraftStateDto>(`/leagues/${id}/draft`, accessToken ?? undefined),
    enabled: !!accessToken && !!id && !!league?.draftStatus,
  });

  const drawMutation = useMutation({
    mutationFn: () => api.post<void>(`/leagues/${id}/draw`, {}, accessToken ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['league', id] });
      queryClient.invalidateQueries({ queryKey: ['draft', id] });
    },
  });

  const startMutation = useMutation({
    mutationFn: () => api.post<void>(`/leagues/${id}/draft/start`, {}, accessToken ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['league', id] });
    },
  });

  function copyCode() {
    if (!league) return;
    navigator.clipboard.writeText(league.inviteCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (isLoading) return <LeagueSkeleton />;
  if (!league) return null;

  const isOwner = league.ownerId === user?.id;
  const status = league.draftStatus;
  const orderDrawn = !!status;
  const canDraw = isOwner && status !== DraftStatus.IN_PROGRESS && status !== DraftStatus.COMPLETED;
  const canStart = isOwner && status === DraftStatus.PENDING;
  const inProgress = status === DraftStatus.IN_PROGRESS;
  const completed = status === DraftStatus.COMPLETED;

  const memberMap = new Map(league.members.map((m) => [m.membershipId, m]));
  const orderedMembers =
    draftState?.order.flatMap((mid) => {
      const m = memberMap.get(mid);
      return m ? [m] : [];
    }) ?? [];

  const drawError =
    drawMutation.error instanceof ApiError
      ? drawMutation.error.message
      : drawMutation.error
        ? 'Erro inesperado.'
        : '';
  const startError =
    startMutation.error instanceof ApiError
      ? startMutation.error.message
      : startMutation.error
        ? 'Erro inesperado.'
        : '';

  return (
    <div className="space-y-8">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="border-b border-border pb-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate font-display text-5xl text-text-primary">{league.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="font-body text-sm text-text-secondary">
                {league.memberCount} / {league.maxTeams} times
              </span>
              <DraftStatusBadge status={status} />
            </div>
          </div>

          <div className="flex flex-shrink-0 flex-wrap gap-2">
            {inProgress && (
              <Link
                href={`/leagues/${id}/draft`}
                className="rounded bg-emerald-500 px-5 py-2 font-body font-semibold text-background transition-colors duration-base hover:bg-emerald-400"
              >
                Sala de Draft →
              </Link>
            )}

            {completed && (
              <Link
                href={`/leagues/${id}/lineup`}
                className="rounded bg-amber-500 px-5 py-2 font-body font-semibold text-background transition-colors duration-base hover:bg-amber-400"
              >
                Montar Escalação →
              </Link>
            )}

            {canDraw && (
              <button
                onClick={() => drawMutation.mutate()}
                disabled={drawMutation.isPending || league.memberCount < 2}
                className="rounded border border-border px-5 py-2 font-body text-sm font-semibold text-text-secondary transition-colors duration-base hover:border-amber-500 hover:text-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {drawMutation.isPending
                  ? 'Sorteando...'
                  : orderDrawn
                    ? '↺ Sortear novamente'
                    : 'Sortear ordem'}
              </button>
            )}

            {canStart && (
              <button
                onClick={() => startMutation.mutate()}
                disabled={startMutation.isPending}
                className="rounded bg-amber-500 px-5 py-2 font-body font-semibold text-background transition-colors duration-base hover:bg-amber-400 disabled:opacity-50"
              >
                {startMutation.isPending ? 'Iniciando...' : '▶ Iniciar Draft'}
              </button>
            )}
          </div>
        </div>

        {(drawError || startError) && (
          <p className="mt-3 text-sm text-red-400">{drawError || startError}</p>
        )}
      </div>

      {/* ── Draft order (shown after draw) ──────────────────────────────── */}
      {orderDrawn && orderedMembers.length > 0 && (
        <section className="space-y-5">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-2xl text-text-secondary">ORDEM DO DRAFT</h2>
            <span className="rounded bg-surface-2 px-2 py-0.5 text-2xs font-semibold uppercase tracking-widest text-text-muted">
              snake
            </span>
          </div>

          {/* Round 1 */}
          <div className="space-y-2">
            <p className="text-2xs font-semibold uppercase tracking-widest text-text-muted">
              Rodada 1 →
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 md:grid-cols-4">
              {orderedMembers.map((m, idx) => (
                <OrderCard
                  key={m.membershipId + '-r1'}
                  pick={idx + 1}
                  member={m}
                  isMe={m.userId === user?.id}
                  dim={false}
                />
              ))}
            </div>
          </div>

          {/* Round 2 — reversed */}
          {orderedMembers.length > 1 && (
            <div className="space-y-2">
              <p className="text-2xs font-semibold uppercase tracking-widest text-text-muted">
                Rodada 2 ← (invertida)
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 md:grid-cols-4">
                {[...orderedMembers].reverse().map((m, idx) => (
                  <OrderCard
                    key={m.membershipId + '-r2'}
                    pick={orderedMembers.length + idx + 1}
                    member={m}
                    isMe={m.userId === user?.id}
                    dim={true}
                  />
                ))}
              </div>
            </div>
          )}

          {completed && (
            <p className="text-sm text-emerald-400">✓ Draft concluído — confira a classificação.</p>
          )}
        </section>
      )}

      {/* ── Empty state: order not drawn yet ────────────────────────────── */}
      {!orderDrawn && isOwner && league.memberCount >= 2 && (
        <div className="rounded border border-border bg-surface p-8 text-center">
          <p className="font-display text-2xl text-text-secondary">ORDEM NÃO SORTEADA</p>
          <p className="mt-2 text-sm text-text-secondary">
            Use o botão acima para sortear a sequência do draft.
          </p>
        </div>
      )}

      {/* ── Members ─────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="font-display text-2xl text-text-secondary">TIMES</h2>

        {league.members.length === 0 ? (
          <div className="rounded border border-border bg-surface p-8 text-center">
            <p className="font-display text-2xl text-text-secondary">NENHUM TIME AINDA</p>
            <p className="mt-2 text-sm text-text-secondary">
              Compartilhe o código de convite para que outros entrem.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border rounded border border-border bg-surface">
            {league.members.map((member) => {
              const draftPos = draftState?.order.indexOf(member.membershipId) ?? -1;
              return (
                <div
                  key={member.membershipId}
                  className="flex items-center justify-between px-5 py-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-body font-semibold text-text-primary">{member.teamName}</p>
                      {league.ownerId === member.userId && (
                        <span className="rounded bg-amber-500/15 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wider text-amber-400">
                          comissário
                        </span>
                      )}
                      {member.userId === user?.id && (
                        <span className="rounded bg-sky-500/15 px-2 py-0.5 text-2xs font-semibold uppercase tracking-wider text-sky-400">
                          você
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-text-secondary">@{member.username}</p>
                  </div>

                  {draftPos >= 0 && (
                    <span className="font-display text-2xl text-text-secondary">
                      #{draftPos + 1}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Invite code ─────────────────────────────────────────────────── */}
      <section className="flex flex-col gap-4 rounded border border-border bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-widest text-text-secondary">
            Código de convite
          </p>
          <p className="mt-1 font-display text-3xl tracking-widest text-amber-400">
            {league.inviteCode}
          </p>
        </div>
        <button
          onClick={copyCode}
          className="rounded border border-border px-4 py-2 font-body text-sm font-semibold text-text-secondary transition-colors duration-base hover:border-amber-500 hover:text-amber-400"
        >
          {copied ? '✓ Copiado' : 'Copiar código'}
        </button>
      </section>

      {/* ── Waiting hint (owner with < 2 members) ───────────────────────── */}
      {isOwner && league.memberCount < 2 && (
        <p className="text-sm text-text-secondary">
          Você é o único membro por enquanto. O sorteio requer ao menos 2 times.
        </p>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

interface OrderCardProps {
  pick: number;
  member: LeagueMemberDto;
  isMe: boolean;
  dim: boolean;
}

function OrderCard({ pick, member, isMe, dim }: OrderCardProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded border p-3',
        isMe
          ? dim
            ? 'border-amber-500/40 bg-amber-500/5'
            : 'border-amber-500/60 bg-amber-500/10'
          : 'border-border bg-surface',
        dim && 'opacity-60',
      )}
    >
      <span
        className={cn(
          'font-display text-4xl leading-none',
          isMe ? 'text-amber-400' : dim ? 'text-text-muted' : 'text-text-secondary',
        )}
      >
        {pick}
      </span>
      <div className="min-w-0">
        <p
          className={cn(
            'truncate font-condensed font-semibold uppercase',
            isMe ? 'text-text-primary' : 'text-text-secondary',
          )}
        >
          {member.teamName}
        </p>
        <p className="truncate text-xs text-text-muted">@{member.username}</p>
      </div>
    </div>
  );
}

function LeagueSkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      <div className="border-b border-border pb-6">
        <div className="h-12 w-56 rounded bg-surface" />
        <div className="mt-2 h-4 w-32 rounded bg-surface" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded border border-border bg-surface" />
        ))}
      </div>
    </div>
  );
}
