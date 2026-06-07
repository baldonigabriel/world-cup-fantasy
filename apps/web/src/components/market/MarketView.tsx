'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Position, TradeStatus } from '@wcf/shared';
import { useAuthStore } from '@/store/auth.store';
import { api, ApiError } from '@/lib/api';
import { cn } from '@/lib/cn';
import type { LeagueMemberDto, LeagueResponseDto } from '@/app/(app)/leagues/types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TradeWindow {
  id: string;
  leagueId: string;
  opensAt: string;
  closesAt: string;
  isOpen: boolean;
}

interface TradePlayer {
  id: string;
  name: string;
  position: Position;
  countryCode: string;
}

interface TradeItem {
  playerId: string;
  fromRosterId: string;
  toRosterId: string;
  player: TradePlayer;
}

interface Trade {
  id: string;
  status: TradeStatus;
  leagueId: string;
  proposerRosterId: string;
  receiverRosterId: string;
  tradeWindowId: string | null;
  items: TradeItem[];
  createdAt: string;
}

interface RosterPlayer {
  id: string;
  name: string;
  position: Position;
  countryCode: string;
  countryName: string;
  photoUrl: string | null;
}

interface FreeAgent {
  id: string;
  name: string;
  position: Position;
  countryCode: string;
  countryName: string;
  photoUrl: string | null;
}

const POSITION_BADGE: Record<Position, string> = {
  [Position.GOL]: 'bg-amber-500/20 text-amber-400',
  [Position.DEF]: 'bg-sky-500/20 text-sky-400',
  [Position.MEI]: 'bg-emerald-500/20 text-emerald-400',
  [Position.ATA]: 'bg-red-500/20 text-red-400',
};

const POSITIONS = [Position.GOL, Position.DEF, Position.MEI, Position.ATA];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error) return 'Erro inesperado. Tente novamente.';
  return '';
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

export function MarketView() {
  const { accessToken, user } = useAuthStore();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'trocas' | 'agentes'>('trocas');

  const { data: leagues, isLoading: leaguesLoading } = useQuery<LeagueResponseDto[]>({
    queryKey: ['my-leagues'],
    queryFn: () => api.get<LeagueResponseDto[]>('/leagues/me', accessToken ?? undefined),
    enabled: !!accessToken,
  });

  // v1: one league per user
  const league = leagues?.[0] ?? null;
  const myRosterId = league?.members.find((m) => m.userId === user?.id)?.rosterId ?? null;
  const isOwner = !!league && !!user && league.ownerId === user.id;

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

  function handleWindowCreated() {
    queryClient.invalidateQueries({ queryKey: ['trade-windows', league?.id] });
  }

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

      {!windowsLoading && (
        <>
          {openWindow && <OpenWindowPanel countdown={closesCountdown} />}

          {!openWindow && (
            <ClosedWindowPanel upcomingWindow={upcomingWindow} countdown={opensCountdown} />
          )}

          {isOwner && (
            <TradeWindowAdminPanel
              leagueId={league.id}
              accessToken={accessToken}
              onCreated={handleWindowCreated}
            />
          )}

          {openWindow && myRosterId && (
            <>
              <MarketTabs tab={tab} onChange={setTab} />

              {tab === 'trocas' && (
                <TradesTab
                  leagueId={league.id}
                  league={league}
                  myRosterId={myRosterId}
                  accessToken={accessToken}
                />
              )}

              {tab === 'agentes' && (
                <FreeAgentsTab
                  leagueId={league.id}
                  myRosterId={myRosterId}
                  accessToken={accessToken}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── Window status panels ─────────────────────────────────────────────────────

function OpenWindowPanel({ countdown }: { countdown: string | null }) {
  return (
    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.05] px-6 py-10 text-center">
      <CheckCircleIcon className="mx-auto h-8 w-8 text-emerald-400" />
      <p className="mt-3 font-display text-3xl text-emerald-400">MERCADO ABERTO</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-text-secondary">
        Proponha trocas com outros times e contrate free agents enquanto a janela estiver aberta.
      </p>
      {countdown && (
        <p className="mt-5 text-xs font-bold uppercase tracking-widest text-emerald-400">
          Fecha em {countdown}
        </p>
      )}
    </div>
  );
}

function ClosedWindowPanel({
  upcomingWindow,
  countdown,
}: {
  upcomingWindow: TradeWindow | null;
  countdown: string | null;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface px-6 py-10 text-center">
      <LockIcon className="mx-auto h-8 w-8 text-text-secondary opacity-60" />
      <p className="mt-3 font-display text-3xl text-text-secondary">MERCADO ABRE NAS OITAVAS</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-text-secondary">
        Trocas entre times e contratações de free agents ficam disponíveis até a véspera da primeira
        partida do mata-mata.
      </p>
      {upcomingWindow && (
        <div className="mt-5 space-y-1">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-400">
            {countdown ? `Abre em ${countdown}` : 'Abre em breve'}
          </p>
          <p className="text-[11px] text-text-secondary">
            Abertura prevista: {formatDateTime(upcomingWindow.opensAt)}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Admin: create trade window ───────────────────────────────────────────────

function TradeWindowAdminPanel({
  leagueId,
  accessToken,
  onCreated,
}: {
  leagueId: string;
  accessToken: string | null;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [opensAt, setOpensAt] = useState('');
  const [closesAt, setClosesAt] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      api.post<TradeWindow>(
        `/leagues/${leagueId}/trade-windows`,
        { opensAt: new Date(opensAt).toISOString(), closesAt: new Date(closesAt).toISOString() },
        accessToken ?? undefined,
      ),
    onSuccess: () => {
      setOpen(false);
      setOpensAt('');
      setClosesAt('');
      onCreated();
    },
  });

  const clientError =
    opensAt && closesAt && new Date(closesAt).getTime() <= new Date(opensAt).getTime()
      ? 'O fechamento precisa ser depois da abertura.'
      : '';

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (clientError) return;
    mutation.mutate();
  }

  const error = clientError || errorMessage(mutation.error);

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full cursor-pointer items-center justify-between text-left"
      >
        <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary">
          Comissário
        </span>
        <span className="text-sm font-semibold text-amber-400 transition-colors duration-150 hover:text-amber-300">
          {open ? 'Fechar' : '+ Criar janela de trocas'}
        </span>
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label
                htmlFor="opensAt"
                className="text-xs font-semibold uppercase tracking-wider text-text-secondary"
              >
                Abre em
              </label>
              <input
                id="opensAt"
                type="datetime-local"
                required
                value={opensAt}
                onChange={(e) => setOpensAt(e.target.value)}
                className="w-full cursor-pointer rounded border border-border bg-surface-2 px-3 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-amber-500"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="closesAt"
                className="text-xs font-semibold uppercase tracking-wider text-text-secondary"
              >
                Fecha em
              </label>
              <input
                id="closesAt"
                type="datetime-local"
                required
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                className="w-full cursor-pointer rounded border border-border bg-surface-2 px-3 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-amber-500"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={mutation.isPending || !opensAt || !closesAt || !!clientError}
            className="w-full cursor-pointer rounded bg-amber-500 py-2.5 text-sm font-bold text-background transition-colors duration-150 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mutation.isPending ? 'Criando...' : 'Criar janela'}
          </button>
        </form>
      )}
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function MarketTabs({
  tab,
  onChange,
}: {
  tab: 'trocas' | 'agentes';
  onChange: (tab: 'trocas' | 'agentes') => void;
}) {
  return (
    <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
      {[
        { id: 'trocas' as const, label: 'Trocas' },
        { id: 'agentes' as const, label: 'Free Agents' },
      ].map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            'flex-1 cursor-pointer rounded px-3 py-2 text-sm font-semibold transition-colors duration-200',
            tab === t.id
              ? 'bg-amber-500 text-background'
              : 'text-text-secondary hover:text-text-primary',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Trades tab ───────────────────────────────────────────────────────────────

function TradesTab({
  leagueId,
  league,
  myRosterId,
  accessToken,
}: {
  leagueId: string;
  league: LeagueResponseDto;
  myRosterId: string;
  accessToken: string | null;
}) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [actionError, setActionError] = useState('');

  const { data: trades, isLoading } = useQuery<Trade[]>({
    queryKey: ['trades', leagueId],
    queryFn: () => api.get<Trade[]>(`/leagues/${leagueId}/trades`, accessToken ?? undefined),
    enabled: !!accessToken && !!leagueId,
  });

  const received = useMemo(
    () =>
      trades?.filter(
        (t) => t.status === TradeStatus.PENDING && t.receiverRosterId === myRosterId,
      ) ?? [],
    [trades, myRosterId],
  );
  const sent = useMemo(
    () =>
      trades?.filter(
        (t) => t.status === TradeStatus.PENDING && t.proposerRosterId === myRosterId,
      ) ?? [],
    [trades, myRosterId],
  );

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['trades', leagueId] });
  }

  const acceptMutation = useMutation({
    mutationFn: (tradeId: string) =>
      api.post<Trade>(`/trades/${tradeId}/accept`, {}, accessToken ?? undefined),
    onSuccess: () => {
      setActionError('');
      invalidate();
    },
    onError: (e) => setActionError(errorMessage(e)),
  });
  const rejectMutation = useMutation({
    mutationFn: (tradeId: string) =>
      api.post<Trade>(`/trades/${tradeId}/reject`, {}, accessToken ?? undefined),
    onSuccess: () => {
      setActionError('');
      invalidate();
    },
    onError: (e) => setActionError(errorMessage(e)),
  });
  const cancelMutation = useMutation({
    mutationFn: (tradeId: string) =>
      api.post<Trade>(`/trades/${tradeId}/cancel`, {}, accessToken ?? undefined),
    onSuccess: () => {
      setActionError('');
      invalidate();
    },
    onError: (e) => setActionError(errorMessage(e)),
  });

  const pendingActionId =
    acceptMutation.variables ?? rejectMutation.variables ?? cancelMutation.variables ?? null;
  const isActing = acceptMutation.isPending || rejectMutation.isPending || cancelMutation.isPending;

  return (
    <div className="space-y-5">
      {actionError && (
        <ActionErrorBanner message={actionError} onDismiss={() => setActionError('')} />
      )}

      <div className="flex items-center justify-between gap-3">
        <h2 className="font-condensed text-sm font-semibold uppercase tracking-widest text-text-secondary">
          Propostas
        </h2>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="cursor-pointer rounded bg-amber-500 px-4 py-2 text-sm font-bold text-background transition-colors duration-150 hover:bg-amber-400"
        >
          {showForm ? 'Cancelar' : '+ Nova proposta'}
        </button>
      </div>

      {showForm && (
        <ProposeTradeForm
          leagueId={leagueId}
          league={league}
          myRosterId={myRosterId}
          accessToken={accessToken}
          onSuccess={() => {
            setShowForm(false);
            invalidate();
          }}
        />
      )}

      {isLoading && <ListSkeleton rows={3} />}

      {!isLoading && (
        <>
          <TradeListSection title={`Recebidas (${received.length})`}>
            {received.length === 0 && <EmptyHint text="Nenhuma proposta recebida no momento." />}
            {received.map((trade) => (
              <TradeCard key={trade.id} trade={trade} myRosterId={myRosterId} league={league}>
                <button
                  onClick={() => acceptMutation.mutate(trade.id)}
                  disabled={isActing}
                  className="flex-1 cursor-pointer rounded bg-emerald-500 py-2 text-sm font-bold text-background transition-colors duration-150 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {acceptMutation.isPending && pendingActionId === trade.id
                    ? 'Aceitando...'
                    : 'Aceitar'}
                </button>
                <button
                  onClick={() => rejectMutation.mutate(trade.id)}
                  disabled={isActing}
                  className="flex-1 cursor-pointer rounded border border-border py-2 text-sm font-bold text-text-secondary transition-colors duration-150 hover:border-red-500/40 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {rejectMutation.isPending && pendingActionId === trade.id
                    ? 'Recusando...'
                    : 'Recusar'}
                </button>
              </TradeCard>
            ))}
          </TradeListSection>

          <TradeListSection title={`Enviadas (${sent.length})`}>
            {sent.length === 0 && <EmptyHint text="Você não tem propostas pendentes enviadas." />}
            {sent.map((trade) => (
              <TradeCard key={trade.id} trade={trade} myRosterId={myRosterId} league={league}>
                <button
                  onClick={() => cancelMutation.mutate(trade.id)}
                  disabled={isActing}
                  className="flex-1 cursor-pointer rounded border border-border py-2 text-sm font-bold text-text-secondary transition-colors duration-150 hover:border-red-500/40 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {cancelMutation.isPending && pendingActionId === trade.id
                    ? 'Cancelando...'
                    : 'Cancelar proposta'}
                </button>
              </TradeCard>
            ))}
          </TradeListSection>
        </>
      )}
    </div>
  );
}

function TradeListSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-xs font-bold uppercase tracking-widest text-text-secondary">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function TradeCard({
  trade,
  myRosterId,
  league,
  children,
}: {
  trade: Trade;
  myRosterId: string;
  league: LeagueResponseDto;
  children: React.ReactNode;
}) {
  const myItem = trade.items.find((i) => i.fromRosterId === myRosterId) ?? null;
  const theirItem = trade.items.find((i) => i.fromRosterId !== myRosterId) ?? null;
  const otherRosterId = myItem?.toRosterId ?? theirItem?.fromRosterId ?? null;
  const otherMember = league.members.find((m) => m.rosterId === otherRosterId) ?? null;

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3 text-xs text-text-secondary">
        <span className="font-semibold text-text-primary">
          {otherMember?.teamName ?? 'Time desconhecido'}
        </span>
        <span>{formatDateTime(trade.createdAt)}</span>
      </div>

      <div className="flex items-center gap-2">
        <PlayerChip player={myItem?.player ?? null} label="Você oferece" />
        <SwapIcon className="h-4 w-4 shrink-0 text-text-secondary" />
        <PlayerChip player={theirItem?.player ?? null} label="Você recebe" />
      </div>

      <div className="flex gap-2">{children}</div>
    </div>
  );
}

function PlayerChip({ player, label }: { player: TradePlayer | null; label: string }) {
  if (!player) {
    return (
      <div className="min-w-0 flex-1 rounded-lg border border-border/50 bg-surface-2 px-3 py-2">
        <p className="text-[10px] uppercase tracking-wider text-text-secondary">{label}</p>
        <p className="text-sm text-text-secondary">—</p>
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1 rounded-lg border border-border/50 bg-surface-2 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-text-secondary">{label}</p>
      <div className="mt-0.5 flex items-center gap-1.5">
        <span
          className={cn(
            'shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold',
            POSITION_BADGE[player.position],
          )}
        >
          {player.position}
        </span>
        <p className="truncate text-sm font-semibold text-text-primary">{player.name}</p>
      </div>
      <p className="text-[10px] text-text-secondary">{player.countryCode}</p>
    </div>
  );
}

// ─── Propose trade form ───────────────────────────────────────────────────────

function ProposeTradeForm({
  leagueId,
  league,
  myRosterId,
  accessToken,
  onSuccess,
}: {
  leagueId: string;
  league: LeagueResponseDto;
  myRosterId: string;
  accessToken: string | null;
  onSuccess: () => void;
}) {
  const [offeredPlayerId, setOfferedPlayerId] = useState('');
  const [receiverRosterId, setReceiverRosterId] = useState('');
  const [requestedPlayerId, setRequestedPlayerId] = useState('');

  const { data: myRoster } = useQuery<RosterPlayer[]>({
    queryKey: ['roster-players', leagueId, myRosterId],
    queryFn: () =>
      api.get<RosterPlayer[]>(
        `/leagues/${leagueId}/rosters/${myRosterId}`,
        accessToken ?? undefined,
      ),
    enabled: !!accessToken && !!myRosterId,
  });

  const offeredPlayer = myRoster?.find((p) => p.id === offeredPlayerId) ?? null;

  const otherMembers: LeagueMemberDto[] = league.members.filter((m) => m.rosterId !== myRosterId);

  const { data: opponentRoster, isFetching: opponentLoading } = useQuery<RosterPlayer[]>({
    queryKey: ['roster-players', leagueId, receiverRosterId],
    queryFn: () =>
      api.get<RosterPlayer[]>(
        `/leagues/${leagueId}/rosters/${receiverRosterId}`,
        accessToken ?? undefined,
      ),
    enabled: !!accessToken && !!receiverRosterId,
  });

  const eligibleOpponentPlayers = useMemo(
    () =>
      offeredPlayer
        ? (opponentRoster ?? []).filter((p) => p.position === offeredPlayer.position)
        : [],
    [opponentRoster, offeredPlayer],
  );

  const mutation = useMutation({
    mutationFn: () =>
      api.post<Trade>(
        `/leagues/${leagueId}/trades`,
        { offeredPlayerId, requestedPlayerId, receiverRosterId },
        accessToken ?? undefined,
      ),
    onSuccess: () => {
      setOfferedPlayerId('');
      setReceiverRosterId('');
      setRequestedPlayerId('');
      onSuccess();
    },
  });

  function handleOfferedChange(id: string) {
    setOfferedPlayerId(id);
    setReceiverRosterId('');
    setRequestedPlayerId('');
  }
  function handleTeamChange(rosterId: string) {
    setReceiverRosterId(rosterId);
    setRequestedPlayerId('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!offeredPlayerId || !receiverRosterId || !requestedPlayerId) return;
    mutation.mutate();
  }

  const canSubmit = !!offeredPlayerId && !!receiverRosterId && !!requestedPlayerId;
  const error = errorMessage(mutation.error);

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-lg border border-border bg-surface p-4"
    >
      <div className="space-y-1">
        <label
          htmlFor="offeredPlayer"
          className="text-xs font-semibold uppercase tracking-wider text-text-secondary"
        >
          Seu jogador
        </label>
        <select
          id="offeredPlayer"
          value={offeredPlayerId}
          onChange={(e) => handleOfferedChange(e.target.value)}
          className="w-full cursor-pointer rounded border border-border bg-surface-2 px-3 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-amber-500"
        >
          <option value="">Selecione um jogador do seu elenco...</option>
          {POSITIONS.flatMap((pos) =>
            (myRoster ?? [])
              .filter((p) => p.position === pos)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.position} · {p.name} ({p.countryCode})
                </option>
              )),
          )}
        </select>
      </div>

      <div className="space-y-1">
        <label
          htmlFor="receiverRoster"
          className="text-xs font-semibold uppercase tracking-wider text-text-secondary"
        >
          Time adversário
        </label>
        <select
          id="receiverRoster"
          value={receiverRosterId}
          onChange={(e) => handleTeamChange(e.target.value)}
          disabled={!offeredPlayerId}
          className="w-full cursor-pointer rounded border border-border bg-surface-2 px-3 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">Selecione o time...</option>
          {otherMembers.map((m) => (
            <option key={m.rosterId} value={m.rosterId}>
              {m.teamName} (@{m.username})
            </option>
          ))}
        </select>
      </div>

      {receiverRosterId && offeredPlayer && (
        <div className="space-y-1">
          <label
            htmlFor="requestedPlayer"
            className="text-xs font-semibold uppercase tracking-wider text-text-secondary"
          >
            Jogador deles ({offeredPlayer.position})
          </label>
          <select
            id="requestedPlayer"
            value={requestedPlayerId}
            onChange={(e) => setRequestedPlayerId(e.target.value)}
            disabled={opponentLoading || eligibleOpponentPlayers.length === 0}
            className="w-full cursor-pointer rounded border border-border bg-surface-2 px-3 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">
              {opponentLoading ? 'Carregando elenco...' : 'Selecione um jogador...'}
            </option>
            {eligibleOpponentPlayers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.countryCode})
              </option>
            ))}
          </select>
          {!opponentLoading && eligibleOpponentPlayers.length === 0 && (
            <p className="text-xs text-red-400/80">
              Esse time não tem jogadores de {offeredPlayer.position} — troca exige a mesma posição
              dos dois lados, então a proposta não pode ser feita com esse time.
            </p>
          )}
          {!opponentLoading && eligibleOpponentPlayers.length > 0 && (
            <p className="text-[11px] text-text-secondary">
              Só aparecem jogadores de {offeredPlayer.position} — trocas exigem a mesma posição dos
              dois lados.
            </p>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={!canSubmit || mutation.isPending}
        className="w-full cursor-pointer rounded bg-amber-500 py-2.5 text-sm font-bold text-background transition-colors duration-150 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {mutation.isPending ? 'Enviando...' : 'Enviar proposta'}
      </button>
    </form>
  );
}

// ─── Free agents tab ──────────────────────────────────────────────────────────

function FreeAgentsTab({
  leagueId,
  myRosterId,
  accessToken,
}: {
  leagueId: string;
  myRosterId: string;
  accessToken: string | null;
}) {
  const queryClient = useQueryClient();
  const [positionFilter, setPositionFilter] = useState<Position | ''>('');
  const [countryFilter, setCountryFilter] = useState('');
  const [signingAgent, setSigningAgent] = useState<FreeAgent | null>(null);
  const [actionError, setActionError] = useState('');

  const { data: myRoster } = useQuery<RosterPlayer[]>({
    queryKey: ['roster-players', leagueId, myRosterId],
    queryFn: () =>
      api.get<RosterPlayer[]>(
        `/leagues/${leagueId}/rosters/${myRosterId}`,
        accessToken ?? undefined,
      ),
    enabled: !!accessToken && !!myRosterId,
  });

  const myCountryCodes = useMemo(
    () => new Set((myRoster ?? []).map((p) => p.countryCode)),
    [myRoster],
  );

  const { data: freeAgents, isLoading } = useQuery<FreeAgent[]>({
    queryKey: ['free-agents', leagueId, positionFilter, countryFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (positionFilter) params.set('position', positionFilter);
      if (countryFilter) params.set('countryCode', countryFilter);
      const qs = params.toString();
      return api.get<FreeAgent[]>(
        `/leagues/${leagueId}/free-agents${qs ? `?${qs}` : ''}`,
        accessToken ?? undefined,
      );
    },
    enabled: !!accessToken && !!leagueId,
  });

  const signMutation = useMutation({
    mutationFn: (vars: { signPlayerId: string; releasePlayerId: string }) =>
      api.post<void>(`/leagues/${leagueId}/signings`, vars, accessToken ?? undefined),
    onSuccess: () => {
      setActionError('');
      setSigningAgent(null);
      queryClient.invalidateQueries({ queryKey: ['free-agents', leagueId] });
      queryClient.invalidateQueries({ queryKey: ['roster-players', leagueId, myRosterId] });
    },
    onError: (e) => setActionError(errorMessage(e)),
  });

  return (
    <div className="space-y-4">
      {actionError && (
        <ActionErrorBanner message={actionError} onDismiss={() => setActionError('')} />
      )}

      <div className="flex flex-wrap gap-2">
        <select
          value={positionFilter}
          onChange={(e) => setPositionFilter(e.target.value as Position | '')}
          className="cursor-pointer rounded border border-border bg-surface px-3 py-2 text-sm font-semibold text-text-primary outline-none transition-colors focus:border-amber-500/50"
        >
          <option value="">Todas as posições</option>
          {POSITIONS.map((pos) => (
            <option key={pos} value={pos}>
              {pos}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={countryFilter}
          onChange={(e) => setCountryFilter(e.target.value.toUpperCase().slice(0, 3))}
          placeholder="País (ex: BRA)"
          maxLength={3}
          className="w-36 rounded border border-border bg-surface px-3 py-2 text-sm font-semibold uppercase text-text-primary outline-none transition-colors placeholder:normal-case placeholder:text-text-secondary focus:border-amber-500/50"
        />
      </div>

      {isLoading && <ListSkeleton rows={5} />}

      {!isLoading && (freeAgents?.length ?? 0) === 0 && (
        <EmptyState
          title="NENHUM FREE AGENT ENCONTRADO"
          description="Ajuste os filtros ou volte mais tarde — o mercado muda conforme outros times contratam."
        />
      )}

      {!isLoading && freeAgents && freeAgents.length > 0 && (
        <div className="space-y-2">
          {freeAgents.map((agent) => (
            <FreeAgentCard
              key={agent.id}
              agent={agent}
              ineligible={myCountryCodes.has(agent.countryCode)}
              onSign={() => setSigningAgent(agent)}
            />
          ))}
        </div>
      )}

      {signingAgent && (
        <SignFreeAgentDialog
          agent={signingAgent}
          myRoster={myRoster ?? []}
          isPending={signMutation.isPending}
          onCancel={() => {
            setSigningAgent(null);
            signMutation.reset();
          }}
          onConfirm={(releasePlayerId) =>
            signMutation.mutate({ signPlayerId: signingAgent.id, releasePlayerId })
          }
          error={errorMessage(signMutation.error)}
        />
      )}
    </div>
  );
}

function FreeAgentCard({
  agent,
  ineligible,
  onSign,
}: {
  agent: FreeAgent;
  ineligible: boolean;
  onSign: () => void;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-lg border px-4 py-3 transition-colors duration-150',
        ineligible ? 'border-border/30 bg-surface opacity-50' : 'border-border bg-surface',
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            'shrink-0 rounded px-2 py-0.5 text-[10px] font-bold',
            POSITION_BADGE[agent.position],
          )}
        >
          {agent.position}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-text-primary">{agent.name}</p>
          <p className="text-xs text-text-secondary">
            {agent.countryCode} · {agent.countryName}
            {ineligible && (
              <span className="ml-1.5 font-semibold text-red-400/80">
                — você já tem um jogador desse país
              </span>
            )}
          </p>
        </div>
      </div>

      {!ineligible && (
        <button
          onClick={onSign}
          className="shrink-0 cursor-pointer rounded bg-amber-500 px-4 py-1.5 text-sm font-bold text-background transition-colors duration-150 hover:bg-amber-400"
        >
          Contratar
        </button>
      )}
    </div>
  );
}

function SignFreeAgentDialog({
  agent,
  myRoster,
  isPending,
  error,
  onCancel,
  onConfirm,
}: {
  agent: FreeAgent;
  myRoster: RosterPlayer[];
  isPending: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: (releasePlayerId: string) => void;
}) {
  const [releasePlayerId, setReleasePlayerId] = useState('');
  const candidates = myRoster.filter((p) => p.position === agent.position);

  function handleConfirm() {
    if (!releasePlayerId) return;
    onConfirm(releasePlayerId);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md space-y-4 rounded-xl border border-border bg-surface p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="text-[10px] uppercase tracking-widest text-text-secondary">Contratar</p>
          <h3 className="font-display text-2xl text-text-primary">{agent.name}</h3>
          <p className="text-sm text-text-secondary">
            {agent.position} · {agent.countryCode} · {agent.countryName}
          </p>
        </div>

        <div className="space-y-1">
          <label
            htmlFor="releasePlayer"
            className="text-xs font-semibold uppercase tracking-wider text-text-secondary"
          >
            Dispensar (mesma posição: {agent.position})
          </label>
          <select
            id="releasePlayer"
            value={releasePlayerId}
            onChange={(e) => setReleasePlayerId(e.target.value)}
            disabled={candidates.length === 0}
            className="w-full cursor-pointer rounded border border-border bg-surface-2 px-3 py-2.5 text-sm text-text-primary outline-none transition-colors focus:border-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Selecione um jogador para dispensar...</option>
            {candidates.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.countryCode})
              </option>
            ))}
          </select>
          {candidates.length === 0 && (
            <p className="text-xs text-red-400/80">
              Você não tem jogadores de {agent.position} para dispensar — não é possível contratar
              esse free agent agora.
            </p>
          )}
        </div>

        <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2.5">
          <WarningIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p className="text-xs text-amber-400/90">
            Contratação é irreversível enquanto o mercado estiver aberto. O jogador dispensado vira
            free agent e pode ser contratado por outro time.
          </p>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 cursor-pointer rounded border border-border py-2.5 text-sm font-bold text-text-secondary transition-colors duration-150 hover:text-text-primary"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!releasePlayerId || isPending}
            className="flex-1 cursor-pointer rounded bg-amber-500 py-2.5 text-sm font-bold text-background transition-colors duration-150 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPending ? 'Confirmando...' : 'Confirmar contratação'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Shared bits ──────────────────────────────────────────────────────────────

function ActionErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/[0.08] px-4 py-2.5">
      <WarningIcon className="h-4 w-4 shrink-0 text-red-400" />
      <p className="flex-1 text-sm font-semibold text-red-400">{message}</p>
      <button
        onClick={onDismiss}
        aria-label="Fechar erro"
        className="cursor-pointer text-red-400/60 transition-colors hover:text-red-400"
      >
        <XIcon className="h-4 w-4" />
      </button>
    </div>
  );
}

function EmptyHint({ text }: { text: string }) {
  return (
    <p className="rounded-lg border border-dashed border-border px-4 py-3 text-sm text-text-secondary">
      {text}
    </p>
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

function ListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="animate-pulse space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-16 rounded-lg bg-surface" />
      ))}
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

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function SwapIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path d="M3 7a1 1 0 011-1h9.586L11.293 3.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 11-1.414-1.414L14.586 8H4a1 1 0 01-1-1zm14 6a1 1 0 01-1 1H6.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 111.414 1.414L6.414 12H16a1 1 0 011 1z" />
    </svg>
  );
}
