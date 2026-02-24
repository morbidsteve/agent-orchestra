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

export function AgentDesk({ agent }: AgentDeskProps) {
  const Icon = AGENT_ICONS[agent.role] || Terminal;
  const isWorking = agent.visualStatus === 'working';
  const isDone = agent.visualStatus === 'done';
  const isError = agent.visualStatus === 'error';

  return (
    <div className="flex flex-col items-center gap-1">
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
            boxShadow: isWorking
              ? `0 0 15px ${agent.color}66, 0 0 30px ${agent.color}33`
              : `0 0 8px ${agent.color}22`,
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

      {/* Current task */}
      {agent.currentTask && (
        <span className="max-w-32 truncate text-[10px] text-gray-500">
          {agent.currentTask}
        </span>
      )}
    </div>
  );
}
