import { Position, ROSTER_QUOTAS } from '@wcf/shared';
import { cn } from '@/lib/cn';

interface PickedPlayer {
  player: { position: Position; name: string; countryCode: string };
}

interface RosterProgressProps {
  picks: PickedPlayer[];
}

const POSITION_CONFIG: Record<Position, { label: string; color: string; bar: string }> = {
  [Position.GOL]: { label: 'Goleiros', color: 'text-amber-400', bar: 'bg-amber-500' },
  [Position.DEF]: { label: 'Defensores', color: 'text-sky-400', bar: 'bg-sky-500' },
  [Position.MEI]: { label: 'Meias', color: 'text-emerald-400', bar: 'bg-emerald-500' },
  [Position.ATA]: { label: 'Atacantes', color: 'text-red-400', bar: 'bg-red-500' },
};

export function RosterProgress({ picks }: RosterProgressProps) {
  const total = Object.values(ROSTER_QUOTAS).reduce((a, b) => a + b, 0);

  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="mb-5 flex items-baseline justify-between">
        <h3 className="font-display text-xl text-text-secondary">MEU ELENCO</h3>
        <span className="text-sm text-text-secondary">
          {picks.length}/{total}
        </span>
      </div>

      <div className="space-y-5">
        {Object.values(Position).map((pos) => {
          const config = POSITION_CONFIG[pos];
          const posPlayers = picks.filter((p) => p.player.position === pos);
          const quota = ROSTER_QUOTAS[pos];
          const full = posPlayers.length >= quota;

          return (
            <div key={pos}>
              <div className="mb-1.5 flex items-center justify-between">
                <span className={cn('text-xs font-bold uppercase tracking-widest', config.color)}>
                  {config.label}
                </span>
                <span
                  className={cn(
                    'text-xs font-semibold',
                    full ? config.color : 'text-text-secondary',
                  )}
                >
                  {posPlayers.length}/{quota}
                </span>
              </div>

              <div className="mb-2 flex gap-1">
                {Array.from({ length: quota }, (_, i) => (
                  <div
                    key={i}
                    className={cn(
                      'h-1.5 flex-1 rounded-full transition-colors duration-300',
                      i < posPlayers.length ? config.bar : 'bg-surface-2',
                    )}
                  />
                ))}
              </div>

              {posPlayers.length > 0 ? (
                <div className="space-y-1">
                  {posPlayers.map((pick, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="shrink-0 text-[10px] font-semibold text-text-secondary">
                        {pick.player.countryCode}
                      </span>
                      <span className="truncate text-text-primary">{pick.player.name}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-secondary opacity-40">Nenhum ainda</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
