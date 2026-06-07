'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth.store';
import { api } from '@/lib/api';
import type { LeagueResponseDto } from '../leagues/types';

interface TradeWindow {
  id: string;
  leagueId: string;
  opensAt: string;
  closesAt: string;
  isOpen: boolean;
}

// ─── Countdown hook ───────────────────────────────────────────────────────────

function useCountdown(target: string | null): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  if (!target) return null;
  const diff = new Date(target).getTime() - now;
  if (diff <= 0) return null;
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MarketPage() {
  const { accessToken } = useAuthStore();

  const { data: leagues, isLoading: leaguesLoading } = useQuery<LeagueResponseDto[]>({
    queryKey: ['my-leagues'],
    queryFn: () => api.get<LeagueResponseDto[]>('/leagues/me', accessToken ?? undefined),
    enabled: !!accessToken,
  });

  // v1: one league per user
  const league = leagues?.[0] ?? null;

  const { data: windows, isLoading: windowsLoading } = useQuery<TradeWindow[]>({
    queryKey: ['trade-windows', league?.id],
    queryFn: () =>
      api.get<TradeWindow[]>(`/leagues/${league?.id}/trade-windows`, accessToken ?? undefined),
    enabled: !!accessToken && !!league,
  });

  const openWindow = windows?.find((w) => w.isOpen) ?? null;
  const upcomingWindow =
    windows
      ?.filter((w) => !w.isOpen && new Date(w.opensAt).getTime() > Date.now())
      .sort((a, b) => new Date(a.opensAt).getTime() - new Date(b.opensAt).getTime())[0] ?? null;

  const closesCountdown = useCountdown(openWindow?.closesAt ?? null);
  const opensCountdown = useCountdown(upcomingWindow?.opensAt ?? null);

  if (leaguesLoading) return <MarketSkeleton />;

  if (!league) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <p className="font-display text-5xl text-text-secondary">SEM LIGA</p>
        <p className="text-sm text-text-secondary">Entre em uma liga para acessar o mercado.</p>
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
        <h1 className="font-display text-4xl text-text-primary">MERCADO</h1>
      </div>

      {windowsLoading && <MarketSkeleton />}

      {!windowsLoading && openWindow && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.05] px-6 py-12 text-center">
          <CheckCircleIcon className="mx-auto h-8 w-8 text-emerald-400" />
          <p className="mt-3 font-display text-3xl text-emerald-400">MERCADO ABERTO</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-text-secondary">
            Proponha trocas com outros times e contrate free agents enquanto a janela estiver
            aberta.
          </p>
          {closesCountdown && (
            <p className="mt-5 text-xs font-bold uppercase tracking-widest text-emerald-400">
              Fecha em {closesCountdown}
            </p>
          )}
        </div>
      )}

      {!windowsLoading && !openWindow && (
        <div className="rounded-lg border border-border bg-surface px-6 py-12 text-center">
          <LockIcon className="mx-auto h-8 w-8 text-text-secondary opacity-60" />
          <p className="mt-3 font-display text-3xl text-text-secondary">MERCADO FECHADO</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-text-secondary">
            Mercado abre nas oitavas — trocas entre times e contratações de free agents ficam
            disponíveis até a véspera da primeira partida do mata-mata.
          </p>
          {upcomingWindow && opensCountdown && (
            <p className="mt-5 text-xs font-bold uppercase tracking-widest text-amber-400">
              Abre em {opensCountdown}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function MarketSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-10 w-48 rounded-lg bg-surface" />
      <div className="h-48 rounded-lg bg-surface" />
    </div>
  );
}

// ─── Inline icon components (SVG — no emoji) ──────────────────────────────────

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
