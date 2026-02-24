import { useState, useEffect } from 'react';
import { cn } from '../../../lib/cn.ts';

interface OfficeStatusBarProps {
  executionId: string | null;
  currentPhase: string | null;
  startedAt: string | null;
}

// Phase groups: each inner array is a parallel group
const PHASE_GROUPS = [
  [{ id: 'plan', label: 'Plan' }],
  [{ id: 'develop', label: 'Dev' }, { id: 'develop-2', label: 'Dev\u2082' }],
  [{ id: 'test', label: 'Test' }, { id: 'security', label: 'Sec' }],
  [{ id: 'report', label: 'Report' }],
];

const AGENT_COLORS: Record<string, string> = {
  plan: '#3b82f6',
  develop: '#3b82f6',
  'develop-2': '#06b6d4',
  test: '#22c55e',
  security: '#f97316',
  'business-eval': '#a855f7',
  report: '#a855f7',
};

function formatElapsedTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function OfficeStatusBar({ executionId, currentPhase, startedAt }: OfficeStatusBarProps) {
  const [elapsed, setElapsed] = useState(0);
  const [prevStartedAt, setPrevStartedAt] = useState<string | null>(startedAt);

  // Reset elapsed when startedAt changes (during render, not in effect)
  if (prevStartedAt !== startedAt) {
    setPrevStartedAt(startedAt);
    setElapsed(0);
  }

  useEffect(() => {
    if (!startedAt) {
      return;
    }

    const start = new Date(startedAt).getTime();

    function tick() {
      const now = Date.now();
      setElapsed(Math.floor((now - start) / 1000));
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  // Find which group the current phase belongs to
  const currentGroupIndex = currentPhase
    ? PHASE_GROUPS.findIndex(group => group.some(p => p.id === currentPhase))
    : -1;
  const isIdle = !executionId;

  return (
    <div className="flex items-center gap-4 rounded-lg border border-surface-600 bg-surface-800 px-4 py-2">
      {/* Execution ID or Ready label */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Execution:</span>
        {isIdle ? (
          <span className="flex items-center gap-1.5 text-xs font-mono text-gray-300">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500/70" />
            Ready
          </span>
        ) : (
          <span className="text-xs font-mono text-gray-300">
            {executionId}
          </span>
        )}
      </div>

      {/* Separator */}
      <div className="h-4 w-px bg-surface-600" />

      {/* Current phase badge */}
      {currentPhase && (
        <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-400 capitalize">
          {currentPhase}
        </span>
      )}

      {/* Phase group progress */}
      <div className="flex items-center gap-1">
        {PHASE_GROUPS.map((group, gIdx) => (
          <div key={gIdx} className="flex items-center gap-0.5">
            {gIdx > 0 && <div className="mx-0.5 h-px w-2 bg-surface-600" />}
            {group.map((phase) => {
              const isDone = gIdx < currentGroupIndex;
              const isCurrent = gIdx === currentGroupIndex;
              const isFuture = gIdx > currentGroupIndex && currentGroupIndex >= 0;
              return (
                <div
                  key={phase.id}
                  className={cn(
                    'h-2 w-2 rounded-full transition-colors duration-300',
                    isDone && 'bg-green-400',
                    isCurrent && 'bg-blue-400 animate-pulse',
                    isFuture && 'bg-surface-600',
                  )}
                  style={
                    isIdle && currentGroupIndex === -1
                      ? { backgroundColor: AGENT_COLORS[phase.id] ?? '#6b7280', opacity: 0.25 }
                      : undefined
                  }
                  title={phase.label}
                />
              );
            })}
          </div>
        ))}
      </div>

      {/* Separator */}
      <div className="h-4 w-px bg-surface-600" />

      {/* Elapsed time */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Elapsed:</span>
        <span className="text-xs font-mono text-gray-300">
          {startedAt ? formatElapsedTime(elapsed) : isIdle ? 'Idle' : '--:--'}
        </span>
      </div>
    </div>
  );
}
