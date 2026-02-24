import { cn } from '../../../lib/cn.ts';
import { PHASE_LABELS } from '../../../lib/constants.ts';
import type { PipelineStep, PhaseStatus } from '../../../lib/types.ts';
import { CheckCircle, Circle, Loader, XCircle, SkipForward, Zap } from 'lucide-react';
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

function getGroupStatus(group: PipelineStep[]): PhaseStatus {
  if (group.some(s => s.status === 'failed')) return 'failed';
  if (group.some(s => s.status === 'running')) return 'running';
  if (group.every(s => s.status === 'completed')) return 'completed';
  if (group.every(s => s.status === 'skipped')) return 'skipped';
  return 'pending';
}

function groupSteps(steps: PipelineStep[]): PipelineStep[][] {
  const groups: PipelineStep[][] = [];
  let current: PipelineStep[] = [];
  let currentIdx = steps[0]?.group ?? 0;

  for (const step of steps) {
    const g = step.group ?? 0;
    if (g !== currentIdx) {
      groups.push(current);
      current = [];
      currentIdx = g;
    }
    current.push(step);
  }
  if (current.length > 0) groups.push(current);
  return groups;
}

export function PipelineTimeline({ steps }: PipelineTimelineProps) {
  const groups = groupSteps(steps);

  return (
    <div className="rounded-xl border border-surface-600 bg-surface-800 p-6">
      <h2 className="text-sm font-semibold text-gray-200 mb-6">Pipeline Progress</h2>
      <div className="flex items-center">
        {groups.map((group, gIdx) => {
          const isLast = gIdx === groups.length - 1;
          const groupStatus = getGroupStatus(group);
          const lineConfig = statusConfig[groupStatus];
          const isParallel = group.length > 1;

          return (
            <div key={gIdx} className={cn('flex items-center', !isLast && 'flex-1')}>
              {/* Group container */}
              <div className="flex flex-col items-center gap-1.5">
                {isParallel && (
                  <div className="flex items-center gap-1 mb-1">
                    <Zap className="h-2.5 w-2.5 text-amber-400" />
                    <span className="text-[10px] font-semibold tracking-wider text-amber-400 uppercase">Parallel</span>
                  </div>
                )}
                <div className={cn(
                  'flex flex-col items-center gap-2',
                  isParallel && 'rounded-lg border border-surface-600 bg-surface-700/50 px-3 py-2',
                )}>
                  {group.map((step) => {
                    const config = statusConfig[step.status];
                    const Icon = config.icon;

                    return (
                      <div key={step.phase} className="flex items-center gap-2">
                        <div className={cn(
                          'flex items-center justify-center rounded-full border-2',
                          isParallel ? 'h-9 w-9' : 'h-12 w-12',
                          config.bgColor,
                          step.status === 'completed' && 'border-green-500/30',
                          step.status === 'running' && 'border-blue-500/30',
                          step.status === 'failed' && 'border-red-500/30',
                          step.status === 'pending' && 'border-surface-600',
                          step.status === 'skipped' && 'border-surface-600',
                        )}>
                          <Icon className={cn(
                            isParallel ? 'h-4 w-4' : 'h-5 w-5',
                            config.color,
                            step.status === 'running' && 'animate-spin',
                          )} />
                        </div>
                        <span className={cn(
                          'text-xs font-medium whitespace-nowrap',
                          step.status === 'pending' ? 'text-gray-500' : config.color,
                        )}>
                          {PHASE_LABELS[step.phase] ?? step.phase}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Connector Line */}
              {!isLast && (
                <div className={cn('h-0.5 flex-1 mx-3', lineConfig.lineColor)} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
