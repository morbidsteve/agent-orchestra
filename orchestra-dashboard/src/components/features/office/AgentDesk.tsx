import { Terminal, Code, FlaskConical, Shield, Briefcase, CheckCircle, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../../lib/cn.ts';
import type { AgentNode } from '../../../lib/types.ts';

interface AgentDeskProps {
  agent: AgentNode;
}

const AGENT_ICONS: Record<string, LucideIcon> = {
  developer: Terminal,
  'developer-2': Code,
  tester: FlaskConical,
  devsecops: Shield,
  'business-dev': Briefcase,
};

const IDLE_STATUS_TEXT: Record<string, string> = {
  developer: 'Ready to code',
  'developer-2': 'Standing by',
  tester: 'Awaiting tests',
  devsecops: 'Monitoring',
  'business-dev': 'Analyzing',
};

/** Stagger index for breathing animation delay so agents don't pulse in sync */
const ROLE_STAGGER_INDEX: Record<string, number> = {
  developer: 0,
  'developer-2': 1,
  tester: 2,
  devsecops: 3,
  'business-dev': 4,
};

export function AgentDesk({ agent }: AgentDeskProps) {
  const Icon = AGENT_ICONS[agent.role] || Terminal;
  const isIdle = agent.visualStatus === 'idle';
  const isWorking = agent.visualStatus === 'working';
  const isDone = agent.visualStatus === 'done';
  const isError = agent.visualStatus === 'error';

  const staggerDelay = (ROLE_STAGGER_INDEX[agent.role] ?? 0) * 0.7;

  return (
    <div className="flex flex-col items-center gap-1">
      {/* Idle breathing keyframes */}
      {isIdle && (
        <style>{`
          @keyframes idleBreathe {
            0%, 100% { box-shadow: 0 0 8px ${agent.color}22; }
            50% { box-shadow: 0 0 14px ${agent.color}44, 0 0 24px ${agent.color}18; }
          }
        `}</style>
      )}

      {/* Circular container */}
      <div className="relative">
        <div
          className={cn(
            'flex h-20 w-20 items-center justify-center rounded-full border-2 transition-all duration-300',
            isWorking && 'animate-pulse',
          )}
          style={{
            borderColor: agent.color,
            backgroundColor: `${agent.color}15`,
            ...(isWorking
              ? { boxShadow: `0 0 15px ${agent.color}66, 0 0 30px ${agent.color}33` }
              : isIdle
                ? { animation: `idleBreathe 4s ease-in-out ${staggerDelay}s infinite` }
                : { boxShadow: `0 0 8px ${agent.color}22` }),
          }}
        >
          {/* Spinning border overlay when working */}
          {isWorking && (
            <div
              className="absolute inset-0 rounded-full border-2 border-transparent"
              style={{
                borderTopColor: agent.color,
                borderRightColor: agent.color,
                animation: 'spin 1s linear infinite',
              }}
            />
          )}

          <Icon className="h-8 w-8" style={{ color: agent.color }} />
        </div>

        {/* Done overlay */}
        {isDone && (
          <div className="absolute -top-1 -right-1 rounded-full bg-surface-900 p-0.5">
            <CheckCircle className="h-5 w-5 text-green-400" />
          </div>
        )}

        {/* Error overlay */}
        {isError && (
          <div className="absolute -top-1 -right-1 rounded-full bg-surface-900 p-0.5">
            <XCircle className="h-5 w-5 text-red-400" />
          </div>
        )}
      </div>

      {/* Agent name */}
      <span className="text-xs font-medium text-gray-300">{agent.name}</span>

      {/* Current task (working state) */}
      {agent.currentTask && (
        <span className="max-w-32 truncate text-[10px] text-gray-500">
          {agent.currentTask}
        </span>
      )}

      {/* Idle status text */}
      {isIdle && !agent.currentTask && (
        <span className="text-[10px] text-gray-600">
          {IDLE_STATUS_TEXT[agent.role] ?? 'Standing by'}
        </span>
      )}
    </div>
  );
}
