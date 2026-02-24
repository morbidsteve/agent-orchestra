import { cn } from '../../../lib/cn.ts';

interface CommandCenterProps {
  currentPhase: string | null;
  agentCount: number;
  isActive: boolean;
  executionId: string | null;
}

function getStatusText(currentPhase: string | null, agentCount: number, isActive: boolean): string {
  if (!isActive && !currentPhase) return 'Ready';
  if (currentPhase === 'plan') return 'Planning...';
  if (currentPhase === 'report') return 'Complete';
  if (agentCount > 0) return `Delegating to ${agentCount} agent${agentCount !== 1 ? 's' : ''}`;
  return currentPhase ? `Phase: ${currentPhase}` : 'Ready';
}

export function CommandCenter({ currentPhase, agentCount, isActive, executionId }: CommandCenterProps) {
  const statusText = getStatusText(currentPhase, agentCount, isActive);

  return (
    <div
      className="absolute"
      style={{
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* Outer glow ring (active only) */}
      {isActive && (
        <div
          className="absolute inset-0 rounded-2xl"
          style={{
            margin: '-8px',
            background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.06) 50%, transparent 70%)',
            animation: 'commandPulse 3s ease-in-out infinite',
          }}
        />
      )}

      <div
        className={cn(
          'relative flex flex-col items-center gap-1.5 rounded-2xl px-8 py-5 transition-all duration-300',
        )}
        style={{
          backgroundColor: '#1e2028',
          border: `2px solid ${isActive ? 'rgba(99,102,241,0.4)' : '#333842'}`,
          boxShadow: isActive
            ? '0 0 24px rgba(99,102,241,0.12), 0 0 48px rgba(139,92,246,0.06), 0 4px 16px rgba(0,0,0,0.4)'
            : '0 4px 16px rgba(0,0,0,0.3)',
          minWidth: '140px',
        }}
      >
        {/* Embedded screen indicators around the edge */}
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 flex gap-3">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className={cn('h-1.5 w-3 rounded-full transition-colors duration-500')}
              style={{
                backgroundColor: isActive ? 'rgba(99,102,241,0.6)' : '#333842',
              }}
            />
          ))}
        </div>
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-3">
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className={cn('h-1.5 w-3 rounded-full transition-colors duration-500')}
              style={{
                backgroundColor: isActive ? 'rgba(139,92,246,0.5)' : '#333842',
              }}
            />
          ))}
        </div>

        {/* Center diamond icon */}
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-block h-3 w-3 rotate-45 rounded-sm transition-colors duration-300',
              isActive ? 'bg-indigo-400' : 'bg-gray-600',
            )}
          />
          <span className="text-sm font-semibold text-gray-200">Orchestrator</span>
          <span
            className={cn(
              'inline-block h-3 w-3 rotate-45 rounded-sm transition-colors duration-300',
              isActive ? 'bg-violet-400' : 'bg-gray-600',
            )}
          />
        </div>

        {/* Status text */}
        <span className={cn(
          'text-xs',
          isActive ? 'text-indigo-300' : 'text-gray-500',
        )}>
          {statusText}
        </span>

        {/* Agent count */}
        {agentCount > 0 && (
          <div className="flex items-center gap-1 rounded-full px-2 py-0.5"
            style={{
              backgroundColor: 'rgba(99,102,241,0.1)',
            }}
          >
            <span className="text-[10px] font-medium text-indigo-400">{agentCount} agents</span>
          </div>
        )}

        {/* Execution ID */}
        {executionId && (
          <span className="text-[10px] text-gray-600 max-w-28 truncate">
            {executionId.slice(0, 12)}
          </span>
        )}
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes commandPulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.04); }
        }
      `}</style>
    </div>
  );
}
