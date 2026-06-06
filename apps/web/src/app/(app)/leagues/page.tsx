'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { api } from '@/lib/api';
import { DraftStatusBadge } from '@/components/leagues/DraftStatusBadge';
import type { LeagueResponseDto } from './types';

export default function LeaguesPage() {
  const accessToken = useAuthStore((s) => s.accessToken);

  const { data: leagues, isLoading } = useQuery<LeagueResponseDto[]>({
    queryKey: ['my-leagues'],
    queryFn: () => api.get<LeagueResponseDto[]>('/leagues/me', accessToken ?? undefined),
    enabled: !!accessToken,
  });

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <h1 className="font-display text-5xl text-text-primary">MINHAS LIGAS</h1>
        <div className="flex gap-3">
          <Link
            href="/leagues/join"
            className="rounded border border-border px-5 py-2 font-body text-sm font-semibold text-text-secondary transition-colors hover:border-amber-500 hover:text-amber-400"
          >
            Entrar com código
          </Link>
          <Link
            href="/leagues/new"
            className="rounded bg-amber-500 px-5 py-2 font-body text-sm font-semibold text-background transition-colors hover:bg-amber-400"
          >
            + Nova liga
          </Link>
        </div>
      </div>

      {isLoading && <p className="text-text-secondary">Carregando...</p>}

      {!isLoading && (!leagues || leagues.length === 0) && (
        <div className="rounded border border-border bg-surface p-12 text-center">
          <p className="font-display text-3xl text-text-secondary">NENHUMA LIGA AINDA</p>
          <p className="mt-2 text-text-secondary">Crie ou entre em uma liga para começar.</p>
        </div>
      )}

      {leagues && leagues.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {leagues.map((league) => (
            <Link
              key={league.id}
              href={`/leagues/${league.id}`}
              className="group rounded border border-border bg-surface p-6 transition-colors hover:border-amber-500"
            >
              <p className="font-display text-2xl text-text-primary group-hover:text-amber-400">
                {league.name}
              </p>
              <p className="mt-2 text-sm text-text-secondary">
                {league.memberCount} / {league.maxTeams} times
              </p>
              {league.draftStatus && (
                <span className="mt-3 inline-block">
                  <DraftStatusBadge status={league.draftStatus} />
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
