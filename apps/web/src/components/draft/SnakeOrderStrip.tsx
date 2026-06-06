import { cn } from '@/lib/cn';

interface Member {
  teamName: string;
  username: string;
}

interface SnakeOrderStripProps {
  order: string[];
  currentPick: number;
  totalPicks: number;
  nextMembershipId: string | null;
  getMember: (id: string) => Member | undefined;
  myMembershipId: string | undefined;
}

export function SnakeOrderStrip({
  order,
  currentPick,
  totalPicks,
  nextMembershipId,
  getMember,
  myMembershipId,
}: SnakeOrderStripProps) {
  const n = order.length;
  if (n === 0) return null;

  const roundIndex = Math.floor(currentPick / n);
  const pickInRound = currentPick % n;
  const isReversed = roundIndex % 2 === 1;
  const roundOrder = isReversed ? [...order].reverse() : [...order];

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="font-display text-sm tracking-widest text-text-secondary">
          RODADA {roundIndex + 1}
        </span>
        {isReversed && <span className="text-xs text-text-secondary opacity-50">← invertida</span>}
        <span className="ml-auto text-xs text-text-secondary opacity-50">
          {currentPick + 1} / {totalPicks}
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {roundOrder.map((mid, idx) => {
          const member = getMember(mid);
          const hasPicked = idx < pickInRound;
          const isCurrent = mid === nextMembershipId;
          const isMe = mid === myMembershipId;

          return (
            <div
              key={mid}
              className={cn(
                'flex min-w-[88px] shrink-0 flex-col gap-0.5 rounded-lg border px-3 py-2 transition-all duration-200',
                isCurrent
                  ? 'border-amber-500 bg-amber-500/10 shadow-[0_0_16px_rgba(245,158,11,0.25)]'
                  : hasPicked
                    ? 'border-border/30 bg-surface-2 opacity-30'
                    : isMe
                      ? 'border-border bg-surface-2'
                      : 'border-border/40 bg-surface opacity-70',
              )}
            >
              <span
                className={cn(
                  'text-[10px] font-bold uppercase tracking-wide',
                  isCurrent ? 'text-amber-400' : 'text-text-secondary',
                )}
              >
                {hasPicked ? '✓' : isCurrent ? '► NOW' : `#${idx + 1}`}
              </span>
              <span
                className={cn(
                  'truncate text-xs font-semibold',
                  isCurrent ? 'text-text-primary' : 'text-text-secondary',
                )}
              >
                {member?.teamName ?? '—'}
              </span>
              {isMe && (
                <span
                  className={cn(
                    'text-[10px] font-semibold',
                    isCurrent ? 'text-amber-400' : 'text-amber-400/50',
                  )}
                >
                  você
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
