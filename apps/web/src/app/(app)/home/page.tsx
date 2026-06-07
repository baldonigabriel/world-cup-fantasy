'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { DraftStatus } from '@wcf/shared';
import { useAuthStore } from '@/store/auth.store';
import { api } from '@/lib/api';
import { LineupView } from '@/components/lineup/LineupView';
import type { DraftStateDto, LeagueResponseDto } from '../leagues/types';

export default function HomePage() {
  const { accessToken, user } = useAuthStore();

  const { data: leagues, isLoading: leaguesLoading } = useQuery<LeagueResponseDto[]>({
    queryKey: ['my-leagues'],
    queryFn: () => api.get<LeagueResponseDto[]>('/leagues/me', accessToken ?? undefined),
    enabled: !!accessToken,
  });

  // v1: one league per user — the home shows that single league's pitch
  const league = leagues?.[0] ?? null;

  const { data: draft, isLoading: draftLoading } = useQuery<DraftStateDto>({
    queryKey: ['draft', league?.id],
    queryFn: () => api.get<DraftStateDto>(`/leagues/${league?.id}/draft`, accessToken ?? undefined),
    enabled: !!accessToken && !!league,
  });

  const myMembershipId = league?.members.find((m) => m.userId === user?.id)?.membershipId;
  const hasRoster =
    !!draft &&
    draft.status === DraftStatus.COMPLETED &&
    draft.picks.some((p) => p.membershipId === myMembershipId);

  if (leaguesLoading || (league && draftLoading)) return <HomeSkeleton />;

  if (!league || !hasRoster) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <p className="font-display text-4xl text-text-secondary sm:text-5xl">
          VOCÊ AINDA NÃO TEM TIME
        </p>
        <p className="max-w-sm text-sm text-text-secondary">
          Entre em uma liga para começar a montar seu elenco e disputar a Copa.
        </p>
        <Link
          href="/leagues"
          className="rounded bg-amber-500 px-6 py-2.5 font-body text-sm font-bold text-background transition-colors hover:bg-amber-400"
        >
          Ir para Ligas →
        </Link>
      </div>
    );
  }

  return <LineupView leagueId={league.id} />;
}

function HomeSkeleton() {
  return (
    <div className="animate-pulse space-y-5">
      <div className="flex items-center justify-between">
        <div className="h-10 w-40 rounded-lg bg-surface" />
        <div className="h-9 w-32 rounded bg-surface" />
      </div>
      <div className="h-12 rounded-lg bg-surface" />
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="h-[420px] rounded-xl bg-surface lg:col-span-3" />
        <div className="space-y-1.5 lg:col-span-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-11 rounded-lg bg-surface" />
          ))}
        </div>
      </div>
    </div>
  );
}
