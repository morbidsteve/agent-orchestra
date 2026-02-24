import { Activity } from 'lucide-react';
import { cn } from '../../../lib/cn.ts';

interface OrchestratorHubProps {
  currentPhase: string | null;
  executionId: string | null;
  isActive: boolean;
}

export function OrchestratorHub({ currentPhase, executionId, isActive }: OrchestratorHubProps) {
  const isIdle = !isActive;

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Idle breathing keyframes for orchestrator */}
      {isIdle && (
        <style>{`
          @keyframes orchIdleBreathe {
            0%, 100% { box-shadow: 0 0 10px rgba(59, 130, 246, 0.1); }
            50% { box-shadow: 0 0 18px rgba(59, 130, 246, 0.2), 0 0 30px rgba(168, 85, 247, 0.08); }
          }
        `}</style>
      )}

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
            ...(isActive
              ? { boxShadow: '0 0 20px rgba(59, 130, 246, 0.3), 0 0 40px rgba(168, 85, 247, 0.15)' }
              : { animation: 'orchIdleBreathe 5s ease-in-out infinite' }),
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
              'text-blue-400',
            )}
          />
        </div>
      </div>

      {/* Label */}
      <span className="text-sm font-semibold text-gray-200">Orchestrator</span>

      {/* Phase info (active) or Ready badge (idle) */}
      {currentPhase ? (
        <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-400 capitalize">
          {currentPhase}
        </span>
      ) : (
        <span className="rounded-full bg-blue-500/8 px-2 py-0.5 text-[10px] font-medium text-blue-500/60">
          Ready
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
