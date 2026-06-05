import { Position } from '@wcf/shared';
import { cn } from '@/lib/cn';

interface PlayerCardProps {
  id: string;
  name: string;
  position: Position;
  countryCode: string;
  countryName: string;
  photoUrl: string | null;
  isMyTurn: boolean;
  onPick: (playerId: string) => void;
  isPicking: boolean;
}

const POSITION_BADGE: Record<Position, string> = {
  [Position.GOL]: 'bg-amber-500/20 text-amber-400',
  [Position.DEF]: 'bg-sky-500/20 text-sky-400',
  [Position.MEI]: 'bg-emerald-500/20 text-emerald-400',
  [Position.ATA]: 'bg-red-500/20 text-red-400',
};

export function PlayerCard({
  id,
  name,
  position,
  countryCode,
  countryName,
  isMyTurn,
  onPick,
  isPicking,
}: PlayerCardProps) {
  return (
    <div className="flex items-center justify-between rounded border border-border bg-surface px-4 py-3 transition-colors hover:border-border/80">
      <div className="flex items-center gap-3">
        <span className={cn('rounded px-2 py-0.5 text-xs font-semibold', POSITION_BADGE[position])}>
          {position}
        </span>
        <div>
          <p className="font-body font-semibold text-text-primary">{name}</p>
          <p className="text-xs text-text-secondary">{countryName}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-text-secondary">
          {countryCode.slice(0, 3).toUpperCase()}
        </span>
        {isMyTurn && (
          <button
            onClick={() => onPick(id)}
            disabled={isPicking}
            className="rounded bg-amber-500 px-3 py-1 text-xs font-semibold text-background transition-colors hover:bg-amber-400 disabled:opacity-50"
          >
            {isPicking ? '...' : 'Escolher'}
          </button>
        )}
      </div>
    </div>
  );
}
