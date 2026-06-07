'use client';

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

export default function StandingsPage() {
  const { accessToken, user } = useAuthStore();

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
  });

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

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-text-secondary">{league.name}</p>
        <h1 className="font-display text-4xl text-text-primary">CLASSIFICAÇÃO</h1>
      </div>

      {standingsLoading && <StandingsSkeleton />}

      {!standingsLoading && (!standings || standings.length === 0) && (
        <div className="rounded border border-border bg-surface p-12 text-center">
          <p className="font-display text-2xl text-text-secondary">SEM PONTUAÇÃO AINDA</p>
          <p className="mt-2 text-sm text-text-secondary">
            A classificação aparece assim que a primeira rodada for pontuada.
          </p>
        </div>
      )}

      {standings && standings.length > 0 && (
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
              {standings.map((entry) => {
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
      )}
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
