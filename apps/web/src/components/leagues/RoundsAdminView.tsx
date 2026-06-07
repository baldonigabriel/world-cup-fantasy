'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { RoundStage } from '@wcf/shared';
import { useAuthStore } from '@/store/auth.store';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { LeagueResponseDto } from '@/app/(app)/leagues/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Round {
  id: string;
  stage: RoundStage;
  opensAt: string;
  lockAt: string;
  locked: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_LABEL: Record<RoundStage, string> = {
  [RoundStage.GROUP_1]: 'Grupos 1',
  [RoundStage.GROUP_2]: 'Grupos 2',
  [RoundStage.GROUP_3]: 'Grupos 3',
  [RoundStage.R32]: 'Oitavos',
  [RoundStage.R16]: 'Oitavos de final',
  [RoundStage.QF]: 'Quartas',
  [RoundStage.SF]: 'Semifinal',
  [RoundStage.FINAL]: 'Final',
};

const STAGE_OPTIONS = Object.values(RoundStage);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// `datetime-local` inputs give "YYYY-MM-DDTHH:mm" in the browser's local time.
function localInputToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (isNaN(date.getTime())) return null;
  return date.toISOString();
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RoundsAdminView({ leagueId }: { leagueId: string }) {
  const { accessToken, user } = useAuthStore();
  const queryClient = useQueryClient();

  const [stage, setStage] = useState<RoundStage>(RoundStage.GROUP_1);
  const [opensAt, setOpensAt] = useState('');
  const [lockAt, setLockAt] = useState('');
  const [formError, setFormError] = useState('');
  const [confirmingLockId, setConfirmingLockId] = useState<string | null>(null);

  const { data: league, isLoading: leagueLoading } = useQuery<LeagueResponseDto>({
    queryKey: ['league', leagueId],
    queryFn: () => api.get<LeagueResponseDto>(`/leagues/${leagueId}`, accessToken ?? undefined),
    enabled: !!accessToken && !!leagueId,
  });

  const { data: rounds = [], isLoading: roundsLoading } = useQuery<Round[]>({
    queryKey: ['rounds', leagueId],
    queryFn: () => api.get<Round[]>(`/leagues/${leagueId}/rounds`, accessToken ?? undefined),
    enabled: !!accessToken && !!leagueId,
  });

  const isOwner = !!league && league.ownerId === user?.id;

  const createMutation = useMutation({
    mutationFn: (body: { stage: RoundStage; opensAt: string; lockAt: string }) =>
      api.post<Round>(`/leagues/${leagueId}/rounds`, body, accessToken ?? undefined),
    onSuccess: () => {
      setFormError('');
      setOpensAt('');
      setLockAt('');
      queryClient.invalidateQueries({ queryKey: ['rounds', leagueId] });
    },
    onError: (err) => {
      setFormError(err instanceof ApiError ? err.message : 'Erro ao criar rodada.');
    },
  });

  const lockMutation = useMutation({
    mutationFn: (roundId: string) =>
      api.post<void>(`/leagues/${leagueId}/rounds/${roundId}/lock`, {}, accessToken ?? undefined),
    onSuccess: () => {
      setConfirmingLockId(null);
      queryClient.invalidateQueries({ queryKey: ['rounds', leagueId] });
    },
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');

    const opensIso = localInputToIso(opensAt);
    const lockIso = localInputToIso(lockAt);

    if (!opensIso || !lockIso) {
      setFormError('Informe data e hora de abertura e travamento.');
      return;
    }
    if (new Date(lockIso).getTime() <= new Date(opensIso).getTime()) {
      setFormError('O travamento precisa ser depois da abertura.');
      return;
    }

    createMutation.mutate({ stage, opensAt: opensIso, lockAt: lockIso });
  }

  // ── Early returns ──────────────────────────────────────────────────────────

  if (leagueLoading) return <RoundsAdminSkeleton />;

  if (!league) return null;

  if (!isOwner) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <p className="font-display text-5xl text-text-secondary">ACESSO RESTRITO</p>
        <p className="text-sm text-text-secondary">
          Apenas o comissário da liga pode administrar as rodadas.
        </p>
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
    <div className="space-y-6 pb-24">
      {/* ── Header ───────────────────────────────────────────────────────────── */}
      <div>
        <Link
          href={`/leagues/${leagueId}`}
          className="mb-1 inline-flex cursor-pointer items-center gap-1 text-xs text-text-secondary transition-colors duration-150 hover:text-amber-400"
        >
          <ChevronLeftIcon className="h-3 w-3" />
          {league.name}
        </Link>
        <h1 className="font-display text-4xl text-text-primary">ADMIN DE RODADAS</h1>
      </div>

      {/* ── Create form ──────────────────────────────────────────────────────── */}
      <form
        onSubmit={handleCreate}
        className="space-y-4 rounded-lg border border-border bg-surface p-5"
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
          Nova rodada
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-text-secondary">Fase</span>
            <select
              value={stage}
              onChange={(e) => setStage(e.target.value as RoundStage)}
              className="cursor-pointer rounded border border-border bg-surface-2 px-3 py-2 text-sm font-semibold text-text-primary outline-none transition-colors duration-200 focus:border-amber-500/50"
            >
              {STAGE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABEL[s]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-text-secondary">Abre em</span>
            <input
              type="datetime-local"
              value={opensAt}
              onChange={(e) => setOpensAt(e.target.value)}
              className="rounded border border-border bg-surface-2 px-3 py-2 text-sm font-semibold text-text-primary outline-none transition-colors duration-200 focus:border-amber-500/50"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-text-secondary">Trava em</span>
            <input
              type="datetime-local"
              value={lockAt}
              onChange={(e) => setLockAt(e.target.value)}
              className="rounded border border-border bg-surface-2 px-3 py-2 text-sm font-semibold text-text-primary outline-none transition-colors duration-200 focus:border-amber-500/50"
            />
          </label>
        </div>

        {formError && <p className="text-sm text-red-400">{formError}</p>}

        <button
          type="submit"
          disabled={createMutation.isPending}
          className={cn(
            'rounded px-5 py-2 font-body text-sm font-semibold transition-colors duration-base',
            createMutation.isPending
              ? 'cursor-not-allowed bg-surface-2 text-text-secondary opacity-50'
              : 'cursor-pointer bg-amber-500 text-background hover:bg-amber-400',
          )}
        >
          {createMutation.isPending ? 'Criando...' : 'Criar rodada'}
        </button>
      </form>

      {/* ── List ─────────────────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="font-display text-2xl text-text-secondary">RODADAS</h2>

        {roundsLoading && <RoundsListSkeleton />}

        {!roundsLoading && rounds.length === 0 && (
          <div className="rounded border border-border bg-surface p-8 text-center">
            <p className="font-display text-2xl text-text-secondary">NENHUMA RODADA AINDA</p>
            <p className="mt-2 text-sm text-text-secondary">
              Crie a primeira rodada usando o formulário acima.
            </p>
          </div>
        )}

        {!roundsLoading && rounds.length > 0 && (
          <div className="space-y-3">
            {rounds.map((round) => (
              <RoundRow
                key={round.id}
                round={round}
                isConfirming={confirmingLockId === round.id}
                isLocking={lockMutation.isPending && lockMutation.variables === round.id}
                lockError={
                  confirmingLockId === round.id && lockMutation.isError
                    ? lockMutation.error instanceof ApiError
                      ? lockMutation.error.message
                      : 'Erro ao travar rodada.'
                    : ''
                }
                onRequestLock={() => setConfirmingLockId(round.id)}
                onCancelLock={() => setConfirmingLockId(null)}
                onConfirmLock={() => lockMutation.mutate(round.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── RoundRow ─────────────────────────────────────────────────────────────────

interface RoundRowProps {
  round: Round;
  isConfirming: boolean;
  isLocking: boolean;
  lockError: string;
  onRequestLock: () => void;
  onCancelLock: () => void;
  onConfirmLock: () => void;
}

function RoundRow({
  round,
  isConfirming,
  isLocking,
  lockError,
  onRequestLock,
  onCancelLock,
  onConfirmLock,
}: RoundRowProps) {
  return (
    <div className="rounded-lg border border-border bg-surface px-5 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-xl text-text-primary">{STAGE_LABEL[round.stage]}</p>
            <span
              className={cn(
                'rounded px-2 py-0.5 text-2xs font-semibold uppercase tracking-wider',
                round.locked ? 'bg-red-500/15 text-red-400' : 'bg-emerald-500/15 text-emerald-400',
              )}
            >
              {round.locked ? 'Travada' : 'Aberta'}
            </span>
          </div>
          <p className="mt-1 text-sm text-text-secondary">
            Abre em {formatDateTime(round.opensAt)} · Trava em {formatDateTime(round.lockAt)}
          </p>
        </div>

        {!round.locked && !isConfirming && (
          <button
            onClick={onRequestLock}
            className="shrink-0 cursor-pointer self-start rounded border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-400 transition-colors duration-base hover:bg-red-500/10 sm:self-auto"
          >
            Travar rodada
          </button>
        )}
      </div>

      {isConfirming && (
        <div className="mt-4 space-y-3 rounded border border-red-500/30 bg-red-500/[0.05] p-4">
          <div className="flex items-start gap-2.5">
            <WarningIcon className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
            <p className="text-sm text-text-secondary">
              Travar a rodada{' '}
              <span className="font-semibold text-text-primary">{STAGE_LABEL[round.stage]}</span>{' '}
              congela as escalações e a posse dos elencos neste exato momento — a pontuação será
              calculada sobre essa fotografia.{' '}
              <span className="font-semibold text-red-400">Esta ação não pode ser desfeita.</span>
            </p>
          </div>

          {lockError && <p className="pl-7 text-sm text-red-400">{lockError}</p>}

          <div className="flex flex-wrap gap-2 pl-7">
            <button
              onClick={onConfirmLock}
              disabled={isLocking}
              className={cn(
                'cursor-pointer rounded px-4 py-2 text-sm font-semibold transition-colors duration-base',
                isLocking
                  ? 'cursor-not-allowed bg-surface-2 text-text-secondary opacity-50'
                  : 'bg-red-500 text-background hover:bg-red-400',
              )}
            >
              {isLocking ? 'Travando...' : 'Sim, travar definitivamente'}
            </button>
            <button
              onClick={onCancelLock}
              disabled={isLocking}
              className="cursor-pointer rounded border border-border px-4 py-2 text-sm font-semibold text-text-secondary transition-colors duration-base hover:text-text-primary"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

function RoundsAdminSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div>
        <div className="h-3 w-24 rounded bg-surface" />
        <div className="mt-2 h-10 w-72 rounded bg-surface" />
      </div>
      <div className="h-44 rounded-lg bg-surface" />
      <RoundsListSkeleton />
    </div>
  );
}

function RoundsListSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-20 rounded-lg bg-surface" />
      ))}
    </div>
  );
}

// ─── Inline icon components (SVG — no emoji) ──────────────────────────────────

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
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
