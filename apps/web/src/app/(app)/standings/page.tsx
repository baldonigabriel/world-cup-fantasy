'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { LeagueResponseDto } from '../leagues/types';

interface StandingEntry {
  rank: number;
  rosterId: string;
  teamName: string;
  username: string;
  totalPoints: number;
  roundPoints: Record<string, number>;
}

interface Round {
  id: string;
  stage: string;
  opensAt: string;
  lockAt: string;
  locked: boolean;
}

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

const REFETCH_INTERVAL_MS = 60_000;

export default function StandingsPage() {
  const { accessToken, user } = useAuthStore();

  const [selectedRoundId, setSelectedRoundId] = useState<string | null>(null);

  const { data: leagues, isLoading: leaguesLoading } = useQuery<LeagueResponseDto[]>({
    queryKey: ['my-leagues'],
    queryFn: () => api.get<LeagueResponseDto[]>('/leagues/me', accessToken ?? undefined),
    enabled: !!accessToken,
  });

  // v1: one league per user
  const league = leagues?.[0] ?? null;
  const myRosterId = league?.members.find((m) => m.userId === user?.id)?.rosterId;

  const { data: standings, isLoading: standingsLoading } = useQuery<StandingEntry[]>({
    queryKey: ['standings', league?.id],
    queryFn: () =>
      api.get<StandingEntry[]>(`/leagues/${league?.id}/standings`, accessToken ?? undefined),
    enabled: !!accessToken && !!league,
    refetchInterval: REFETCH_INTERVAL_MS,
  });

  const { data: rounds = [] } = useQuery<Round[]>({
    queryKey: ['rounds', league?.id],
    queryFn: () => api.get<Round[]>(`/leagues/${league?.id}/rounds`, accessToken ?? undefined),
    enabled: !!accessToken && !!league,
  });

  const {
    data: roundStandings,
    isLoading: roundStandingsLoading,
    isFetching: roundStandingsFetching,
  } = useQuery<StandingEntry[]>({
    queryKey: ['standings', league?.id, 'round', selectedRoundId],
    queryFn: () =>
      api.get<StandingEntry[]>(
        `/leagues/${league?.id}/standings/rounds/${selectedRoundId}`,
        accessToken ?? undefined,
      ),
    enabled: !!accessToken && !!league && !!selectedRoundId,
    refetchInterval: REFETCH_INTERVAL_MS,
  });

  // Default to the most recently locked round — the one most likely to carry scores.
  useEffect(() => {
    if (selectedRoundId || rounds.length === 0) return;
    const lastLocked = [...rounds].reverse().find((r) => r.locked);
    setSelectedRoundId(lastLocked?.id ?? rounds[rounds.length - 1].id);
  }, [rounds, selectedRoundId]);

  if (leaguesLoading) return <StandingsSkeleton />;

  if (!league) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <p className="font-display text-5xl text-text-secondary">SEM LIGA</p>
        <p className="text-sm text-text-secondary">Entre em uma liga para ver a classificação.</p>
        <Link
          href="/leagues"
          className="cursor-pointer text-amber-400 transition-colors duration-150 hover:text-amber-300"
        >
          Ir para Ligas →
        </Link>
      </div>
    );
  }

  const hasOverallScores = !!standings && standings.some((entry) => entry.totalPoints > 0);
  const hasRoundScores = !!roundStandings && roundStandings.some((entry) => entry.totalPoints > 0);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs text-text-secondary">{league.name}</p>
        <h1 className="font-display text-4xl text-text-primary">CLASSIFICAÇÃO</h1>
      </div>

      {/* ── Tabela geral ──────────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="font-condensed text-sm font-semibold uppercase tracking-widest text-text-secondary">
          Geral
        </h2>

        {standingsLoading && <TableSkeleton />}

        {!standingsLoading && !hasOverallScores && (
          <EmptyState
            title="NENHUMA RODADA PONTUADA AINDA"
            description="A classificação aparece assim que a primeira rodada for pontuada."
          />
        )}

        {!standingsLoading && hasOverallScores && standings && (
          <StandingsTable entries={standings} myRosterId={myRosterId} />
        )}
      </section>

      {/* ── Detalhamento por rodada ───────────────────────────────────────── */}
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-condensed text-sm font-semibold uppercase tracking-widest text-text-secondary">
            Por rodada
          </h2>

          {rounds.length > 0 && (
            <select
              value={selectedRoundId ?? ''}
              onChange={(e) => setSelectedRoundId(e.target.value)}
              className="cursor-pointer rounded border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-primary outline-none transition-colors duration-200 focus:border-amber-500/50"
            >
              {rounds.map((r) => (
                <option key={r.id} value={r.id}>
                  {STAGE_LABEL[r.stage] ?? r.stage}
                  {r.locked ? ' (travada)' : ' (aberta)'}
                </option>
              ))}
            </select>
          )}
        </div>

        {rounds.length === 0 && (
          <EmptyState
            title="NENHUMA RODADA CRIADA AINDA"
            description="O detalhamento por rodada aparece assim que o comissário criar a primeira rodada."
          />
        )}

        {rounds.length > 0 &&
          (roundStandingsLoading || (roundStandingsFetching && !roundStandings)) && (
            <TableSkeleton />
          )}

        {rounds.length > 0 && !roundStandingsLoading && !hasRoundScores && (
          <EmptyState
            title="RODADA SEM PONTUAÇÃO AINDA"
            description="Os pontos desta rodada aparecem assim que o scoring for processado."
          />
        )}

        {rounds.length > 0 && !roundStandingsLoading && hasRoundScores && roundStandings && (
          <StandingsTable entries={roundStandings} myRosterId={myRosterId} />
        )}
      </section>
    </div>
  );
}

function StandingsTable({
  entries,
  myRosterId,
}: {
  entries: StandingEntry[];
  myRosterId: string | undefined;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface text-[10px] uppercase tracking-widest text-text-secondary">
          <tr>
            <th className="px-4 py-3 font-bold">#</th>
            <th className="px-4 py-3 font-bold">Time</th>
            <th className="px-4 py-3 text-right font-bold">Pontos</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {entries.map((entry) => {
            const isMe = entry.rosterId === myRosterId;
            return (
              <tr key={entry.rosterId} className={cn(isMe && 'bg-amber-500/[0.06]')}>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'font-display text-lg',
                      entry.rank === 1 ? 'text-amber-400' : 'text-text-secondary',
                    )}
                  >
                    {entry.rank}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <p
                    className={cn(
                      'font-semibold leading-tight',
                      isMe ? 'text-amber-400' : 'text-text-primary',
                    )}
                  >
                    {entry.teamName}
                    {isMe && (
                      <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-amber-400/70">
                        você
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-text-secondary">@{entry.username}</p>
                </td>
                <td className="px-4 py-3 text-right font-display text-xl text-text-primary">
                  {(entry.totalPoints / 10).toFixed(1)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded border border-border bg-surface p-12 text-center">
      <p className="font-display text-2xl text-text-secondary">{title}</p>
      <p className="mt-2 text-sm text-text-secondary">{description}</p>
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="h-14 rounded-lg bg-surface" />
      ))}
    </div>
  );
}

function StandingsSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-10 w-64 rounded-lg bg-surface" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-14 rounded-lg bg-surface" />
      ))}
    </div>
  );
}
