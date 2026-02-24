import { useState, useEffect } from 'react';
import { cn } from '../../../lib/cn.ts';

interface OfficeStatusBarProps {
  executionId: string | null;
  currentPhase: string | null;
  startedAt: string | null;
}

const PHASES = ['plan', 'develop', 'test', 'security', 'report'];

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

  const currentPhaseIndex = currentPhase ? PHASES.indexOf(currentPhase) : -1;

  return (
    <div className="flex items-center gap-4 rounded-lg border border-surface-600 bg-surface-800 px-4 py-2">
      {/* Execution ID */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Execution:</span>
        <span className="text-xs font-mono text-gray-300">
          {executionId || 'No active execution'}
        </span>
      </div>

      {/* Separator */}
      <div className="h-4 w-px bg-surface-600" />

      {/* Current phase badge */}
      {currentPhase && (
        <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-400 capitalize">
          {currentPhase}
        </span>
      )}

      {/* Phase progress dots */}
      <div className="flex items-center gap-1.5">
        {PHASES.map((phase, index) => (
          <div
            key={phase}
            className={cn(
              'h-2 w-2 rounded-full transition-colors duration-300',
              index < currentPhaseIndex && 'bg-green-400',
              index === currentPhaseIndex && 'bg-blue-400 animate-pulse',
              index > currentPhaseIndex && 'bg-surface-600',
              currentPhaseIndex === -1 && 'bg-surface-600',
            )}
            title={phase}
          />
        ))}
      </div>

      {/* Separator */}
      <div className="h-4 w-px bg-surface-600" />

      {/* Elapsed time */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500">Elapsed:</span>
        <span className="text-xs font-mono text-gray-300">
          {startedAt ? formatElapsedTime(elapsed) : '--:--'}
        </span>
      </div>
    </div>
  );
}
