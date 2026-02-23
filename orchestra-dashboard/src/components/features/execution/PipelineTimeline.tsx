import { cn } from '../../../lib/cn.ts';
import { PHASE_LABELS } from '../../../lib/constants.ts';
import type { PipelineStep, PhaseStatus } from '../../../lib/types.ts';
import { CheckCircle, Circle, Loader, XCircle, SkipForward } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface PipelineTimelineProps {
  steps: PipelineStep[];
}

const statusConfig: Record<PhaseStatus, { icon: LucideIcon; color: string; lineColor: string; bgColor: string }> = {
  completed: { icon: CheckCircle, color: 'text-green-400', lineColor: 'bg-green-500', bgColor: 'bg-green-500/10' },
  running: { icon: Loader, color: 'text-blue-400', lineColor: 'bg-blue-500', bgColor: 'bg-blue-500/10' },
  failed: { icon: XCircle, color: 'text-red-400', lineColor: 'bg-red-500', bgColor: 'bg-red-500/10' },
  pending: { icon: Circle, color: 'text-gray-500', lineColor: 'bg-surface-600', bgColor: 'bg-surface-700' },
  skipped: { icon: SkipForward, color: 'text-gray-500', lineColor: 'bg-surface-600', bgColor: 'bg-surface-700' },
};

export function PipelineTimeline({ steps }: PipelineTimelineProps) {
  return (
    <div className="rounded-xl border border-surface-600 bg-surface-800 p-6">
      <h2 className="text-sm font-semibold text-gray-200 mb-6">Pipeline Progress</h2>
      <div className="flex items-center">
        {steps.map((step, index) => {
          const config = statusConfig[step.status];
          const Icon = config.icon;
          const isLast = index === steps.length - 1;

          return (
            <div key={step.phase} className={cn('flex items-center', !isLast && 'flex-1')}>
              {/* Node */}
              <div className="flex flex-col items-center gap-2">
                <div className={cn(
                  'flex h-12 w-12 items-center justify-center rounded-full border-2',
                  config.bgColor,
                  step.status === 'completed' && 'border-green-500/30',
                  step.status === 'running' && 'border-blue-500/30',
                  step.status === 'failed' && 'border-red-500/30',
                  step.status === 'pending' && 'border-surface-600',
                  step.status === 'skipped' && 'border-surface-600',
                )}>
                  <Icon className={cn('h-5 w-5', config.color, step.status === 'running' && 'animate-spin')} />
                </div>
                <span className={cn('text-xs font-medium', step.status === 'pending' ? 'text-gray-500' : config.color)}>
                  {PHASE_LABELS[step.phase]}
                </span>
              </div>

              {/* Connector Line */}
              {!isLast && (
                <div className={cn('h-0.5 flex-1 mx-3', config.lineColor)} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
