import { cn } from '../../lib/cn.ts';
import type { PipelineStep } from '../../lib/types.ts';
import { PHASE_LABELS } from '../../lib/constants.ts';

interface ProgressBarProps {
  steps: PipelineStep[];
  className?: string;
}

const statusColors: Record<string, string> = {
  completed: 'bg-green-500',
  running: 'bg-accent-blue animate-pulse',
  failed: 'bg-red-500',
  pending: 'bg-surface-600',
  skipped: 'bg-gray-600',
};

export function ProgressBar({ steps, className }: ProgressBarProps) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {steps.map((step) => (
        <div key={step.phase} className="flex-1 group relative">
          <div
            className={cn(
              'h-2 rounded-full transition-colors',
              statusColors[step.status],
            )}
          />
          <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
            {PHASE_LABELS[step.phase]}
          </span>
        </div>
      ))}
    </div>
  );
}
