import { Activity, Users } from 'lucide-react';
import { cn } from '../../../lib/cn.ts';

interface OrchestratorDeskProps {
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

export function OrchestratorDesk({ currentPhase, agentCount, isActive, executionId }: OrchestratorDeskProps) {
  return (
    <div
      className="absolute"
      style={{
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      }}
    >
      <div
        className={cn(
          'flex flex-col items-center gap-2 rounded-xl border-2 px-6 py-4 transition-all duration-300',
          'bg-gradient-to-br from-blue-500/5 to-purple-500/5',
          isActive
            ? 'border-blue-500/50'
            : 'border-surface-600',
        )}
        style={{
          boxShadow: isActive
            ? '0 0 20px rgba(59, 130, 246, 0.15), 0 0 40px rgba(168, 85, 247, 0.08)'
            : undefined,
        }}
      >
        {/* Active spinning ring */}
        {isActive && (
          <style>{`
            @keyframes orchSpin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        )}

        {/* Icon + title row */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Activity className={cn(
              'h-6 w-6 transition-colors duration-300',
              isActive ? 'text-blue-400' : 'text-gray-500',
            )} />
            {isActive && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
            )}
          </div>
          <span className="text-sm font-semibold text-gray-200">Orchestrator</span>
        </div>

        {/* Status text */}
        <span className={cn(
          'text-xs',
          isActive ? 'text-blue-300' : 'text-gray-500',
        )}>
          {getStatusText(currentPhase, agentCount, isActive)}
        </span>

        {/* Agent count badge */}
        {agentCount > 0 && (
          <div className="flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5">
            <Users className="h-3 w-3 text-blue-400" />
            <span className="text-[10px] font-medium text-blue-400">{agentCount}</span>
          </div>
        )}

        {/* Execution ID */}
        {executionId && (
          <span className="text-[10px] text-gray-500 max-w-28 truncate">
            {executionId.slice(0, 12)}
          </span>
        )}
      </div>
    </div>
  );
}
