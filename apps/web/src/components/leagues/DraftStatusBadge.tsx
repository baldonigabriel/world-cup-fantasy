import { DraftStatus } from '@wcf/shared';
import { cn } from '@/lib/cn';

const variants: Record<DraftStatus, string> = {
  [DraftStatus.PENDING]: 'bg-amber-500/15 text-amber-400',
  [DraftStatus.IN_PROGRESS]: 'bg-emerald-500/15 text-emerald-400',
  [DraftStatus.COMPLETED]: 'bg-surface-2 text-text-secondary',
};

const labels: Record<DraftStatus, string> = {
  [DraftStatus.PENDING]: 'Aguardando início',
  [DraftStatus.IN_PROGRESS]: 'Draft em andamento',
  [DraftStatus.COMPLETED]: 'Draft concluído',
};

interface Props {
  status: DraftStatus | null;
}

export function DraftStatusBadge({ status }: Props) {
  if (!status) return null;
  return (
    <span
      className={cn(
        'rounded px-2 py-0.5 text-2xs font-semibold uppercase tracking-wider',
        variants[status],
      )}
    >
      {labels[status]}
    </span>
  );
}
