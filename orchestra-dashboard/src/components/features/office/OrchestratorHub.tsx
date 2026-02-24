import { Activity } from 'lucide-react';
import { cn } from '../../../lib/cn.ts';

interface OrchestratorHubProps {
  currentPhase: string | null;
  executionId: string | null;
  isActive: boolean;
}

export function OrchestratorHub({ currentPhase, executionId, isActive }: OrchestratorHubProps) {
  return (
    <div className="flex flex-col items-center gap-1">
      {/* Large central circle */}
      <div className="relative">
        <div
          className={cn(
            'flex h-28 w-28 items-center justify-center rounded-full border-2 transition-all duration-300',
            'bg-gradient-to-br from-blue-500/10 to-purple-500/10',
            'border-blue-500/50',
          )}
          style={{
            borderImage: isActive
              ? 'linear-gradient(135deg, #3b82f6, #a855f7) 1'
              : undefined,
            borderColor: isActive ? undefined : '#3b82f680',
            boxShadow: isActive
              ? '0 0 20px rgba(59, 130, 246, 0.3), 0 0 40px rgba(168, 85, 247, 0.15)'
              : '0 0 10px rgba(59, 130, 246, 0.1)',
          }}
        >
          {/* Rotating ring when active */}
          {isActive && (
            <div
              className="absolute inset-[-3px] rounded-full border-2 border-transparent"
              style={{
                borderTopColor: '#3b82f6',
                borderRightColor: '#a855f7',
                animation: 'spin 2s linear infinite',
              }}
            />
          )}

          <Activity
            className={cn(
              'h-10 w-10 transition-colors duration-300',
              isActive ? 'text-blue-400' : 'text-gray-500',
            )}
          />
        </div>
      </div>

      {/* Label */}
      <span className="text-sm font-semibold text-gray-200">Orchestrator</span>

      {/* Phase info */}
      {currentPhase && (
        <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400 capitalize">
          {currentPhase}
        </span>
      )}

      {/* Execution ID */}
      {executionId && (
        <span className="max-w-28 truncate text-[10px] text-gray-500">
          {executionId}
        </span>
      )}
    </div>
  );
}
