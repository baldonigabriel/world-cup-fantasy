import { Position, ROSTER_QUOTAS } from '@wcf/shared';
import { cn } from '@/lib/cn';

interface PickedPlayer {
  player: { position: Position; name: string; countryCode: string };
}

interface RosterProgressProps {
  picks: PickedPlayer[];
}

const POSITION_LABELS: Record<Position, string> = {
  [Position.GOL]: 'GOL',
  [Position.DEF]: 'DEF',
  [Position.MEI]: 'MEI',
  [Position.ATA]: 'ATA',
};

const POSITION_COLORS: Record<Position, string> = {
  [Position.GOL]: 'bg-amber-500',
  [Position.DEF]: 'bg-sky-500',
  [Position.MEI]: 'bg-emerald-500',
  [Position.ATA]: 'bg-red-500',
};

export function RosterProgress({ picks }: RosterProgressProps) {
  const countByPosition = (pos: Position) => picks.filter((p) => p.player.position === pos).length;

  return (
    <div className="space-y-3">
      {Object.values(Position).map((pos) => {
        const current = countByPosition(pos);
        const quota = ROSTER_QUOTAS[pos];
        return (
          <div key={pos}>
            <div className="mb-1 flex justify-between">
              <span className="text-xs font-semibold text-text-secondary">
                {POSITION_LABELS[pos]}
              </span>
              <span
                className={cn(
                  'text-xs font-semibold',
                  current >= quota ? 'text-emerald-400' : 'text-text-secondary',
                )}
              >
                {current}/{quota}
              </span>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: quota }, (_, i) => (
                <div
                  key={i}
                  className={cn(
                    'h-2 flex-1 rounded-sm',
                    i < current ? POSITION_COLORS[pos] : 'bg-surface-2',
                  )}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
