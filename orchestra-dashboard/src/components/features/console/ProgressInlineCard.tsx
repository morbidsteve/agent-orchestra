import { NavLink } from 'react-router-dom';
import { CheckCircle, Circle, Loader } from 'lucide-react';
import { cn } from '../../../lib/cn.ts';

interface PhaseInfo {
  phase: string;
  status: string;
}

interface ProgressInlineCardProps {
  executionId: string;
  currentPhase?: string;
  phases?: PhaseInfo[];
}

const PHASE_LABELS: Record<string, string> = {
  plan: 'Plan',
  develop: 'Develop',
  test: 'Test',
  security: 'Security',
  report: 'Report',
};

function PhaseStatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return <CheckCircle className="h-3 w-3 text-green-400" />;
    case 'running':
      return <Loader className="h-3 w-3 text-accent-blue animate-spin" />;
    case 'failed':
      return <Circle className="h-3 w-3 text-red-400" />;
    default:
      return <Circle className="h-3 w-3 text-gray-500" />;
  }
}

export function ProgressInlineCard({ executionId, currentPhase, phases }: ProgressInlineCardProps) {
  const defaultPhases: PhaseInfo[] = phases ?? [
    { phase: 'plan', status: 'pending' },
    { phase: 'develop', status: 'pending' },
    { phase: 'test', status: 'pending' },
    { phase: 'security', status: 'pending' },
    { phase: 'report', status: 'pending' },
  ];

  // Calculate progress percentage
  const completedCount = defaultPhases.filter(p => p.status === 'completed').length;
  const progressPercent = Math.round((completedCount / defaultPhases.length) * 100);

  return (
    <NavLink
      to={`/executions/${encodeURIComponent(executionId)}`}
      className="block rounded-lg bg-surface-700 border border-surface-600 p-3 hover:border-accent-blue/40 transition-colors"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono text-gray-400">{executionId.slice(0, 12)}</span>
        {currentPhase && (
          <span className="text-xs text-accent-blue font-medium">
            {PHASE_LABELS[currentPhase] ?? currentPhase}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-surface-800 rounded-full mb-2 overflow-hidden">
        <div
          className="h-full bg-accent-blue rounded-full transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Phase dots */}
      <div className="flex items-center gap-3">
        {defaultPhases.map((p) => (
          <div key={p.phase} className="flex items-center gap-1">
            <PhaseStatusIcon status={p.status} />
            <span className={cn(
              'text-xs',
              p.status === 'running' ? 'text-accent-blue' :
              p.status === 'completed' ? 'text-green-400' :
              p.status === 'failed' ? 'text-red-400' :
              'text-gray-500',
            )}>
              {PHASE_LABELS[p.phase] ?? p.phase}
            </span>
          </div>
        ))}
      </div>
    </NavLink>
  );
}
