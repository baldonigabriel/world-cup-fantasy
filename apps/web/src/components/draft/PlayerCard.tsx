import { Position } from '@wcf/shared';
import { cn } from '@/lib/cn';

const POSITION_BADGE: Record<Position, string> = {
  [Position.GOL]: 'bg-amber-500/20 text-amber-400',
  [Position.DEF]: 'bg-sky-500/20 text-sky-400',
  [Position.MEI]: 'bg-emerald-500/20 text-emerald-400',
  [Position.ATA]: 'bg-red-500/20 text-red-400',
};

interface PlayerCardProps {
  id: string;
  name: string;
  position: Position;
  countryCode: string;
  countryName: string;
  isMyTurn: boolean;
  ineligibleReason: string | null;
  onPick: (id: string) => void;
  isPicking: boolean;
}

export function PlayerCard({
  id,
  name,
  position,
  countryCode,
  countryName,
  isMyTurn,
  ineligibleReason,
  onPick,
  isPicking,
}: PlayerCardProps) {
  const ineligible = ineligibleReason !== null;
  const canPick = isMyTurn && !ineligible;

  return (
    <div
      className={cn(
        'flex min-h-[52px] items-center justify-between rounded-lg border px-4 py-3 transition-all duration-200',
        ineligible
          ? 'border-border/30 bg-surface opacity-40'
          : canPick
            ? 'border-border bg-surface hover:border-amber-500/40 hover:bg-surface-2'
            : 'border-border bg-surface hover:border-border/60 hover:bg-surface-2',
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            'shrink-0 rounded px-2 py-0.5 text-[10px] font-bold',
            POSITION_BADGE[position],
          )}
        >
          {position}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-text-primary">{name}</p>
          <p className="text-xs text-text-secondary">
            {countryCode} · {countryName}
            {ineligibleReason && <span className="ml-1.5 text-red-400/70">{ineligibleReason}</span>}
          </p>
        </div>
      </div>

      <div className="ml-3 shrink-0">
        {canPick ? (
          <button
            onClick={() => onPick(id)}
            disabled={isPicking}
            className="cursor-pointer rounded bg-amber-500 px-4 py-1.5 text-sm font-bold text-background transition-colors duration-200 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isPicking ? '···' : 'Escolher'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
