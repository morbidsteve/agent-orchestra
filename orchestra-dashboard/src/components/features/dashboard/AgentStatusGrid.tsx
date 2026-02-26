import { Card } from '../../ui/Card.tsx';
import { StatusDot } from '../../ui/StatusDot.tsx';
import { cn } from '../../../lib/cn.ts';
import type { AgentInfo, AgentStatus, DynamicAgent } from '../../../lib/types.ts';
import {
  Terminal,
  Code,
  FlaskConical,
  Shield,
  Briefcase,
  Palette,
  Server,
  Container,
  Code2,
  TestTube2,
  FileText,
  TrendingUp,
  Bot,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface AgentStatusGridProps {
  agents: AgentInfo[];
  dynamicAgents?: DynamicAgent[];
}

const iconMap: Record<string, LucideIcon> = {
  Terminal,
  Code,
  FlaskConical,
  Shield,
  Briefcase,
  Palette,
  Server,
  Container,
};

const dynamicIconMap: Record<string, LucideIcon> = {
  Code2,
  TestTube2,
  Shield,
  FileText,
  TrendingUp,
  Bot,
  Terminal,
};

function mapDynamicStatus(status: DynamicAgent['status']): AgentStatus {
  if (status === 'running') return 'busy';
  if (status === 'failed') return 'offline';
  return 'idle';
}

function dynamicStatusColor(status: DynamicAgent['status']): string {
  if (status === 'running') return 'text-blue-400';
  if (status === 'completed') return 'text-green-400';
  if (status === 'failed') return 'text-red-400';
  return 'text-gray-500';
}

export function AgentStatusGrid({ agents, dynamicAgents }: AgentStatusGridProps) {
  const hasDynamic = dynamicAgents && dynamicAgents.length > 0;

  return (
    <Card
      header={
        <h2 className="text-sm font-semibold text-gray-200">
          {hasDynamic ? 'Live Agents' : 'Agent Status'}
        </h2>
      }
    >
      {hasDynamic ? (
        <div className="grid grid-cols-4 gap-3">
          {dynamicAgents.map((agent) => {
            const Icon = dynamicIconMap[agent.icon] ?? Bot;
            const dotStatus = mapDynamicStatus(agent.status);
            return (
              <div
                key={agent.id}
                className="flex flex-col items-center gap-2 rounded-lg border border-surface-600 bg-surface-700/50 p-3"
              >
                <div className="relative">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${agent.color}15` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: agent.color }} />
                  </div>
                  <StatusDot
                    status={dotStatus}
                    size="sm"
                    className="absolute -top-1 -right-1"
                  />
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium text-gray-300 truncate max-w-full">
                    {agent.name}
                  </p>
                  <p className={cn('text-xs capitalize', dynamicStatusColor(agent.status))}>
                    {agent.status}
                  </p>
                </div>
                <p className="text-xs text-gray-500 truncate max-w-full">
                  {agent.task || 'idle'}
                </p>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-3">
          {agents.map((agent) => {
            const Icon = iconMap[agent.icon] || Terminal;
            return (
              <div
                key={agent.role}
                className="flex flex-col items-center gap-2 rounded-lg border border-surface-600 bg-surface-700/50 p-3"
              >
                <div className="relative">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${agent.color}15` }}
                  >
                    <Icon className="h-5 w-5" style={{ color: agent.color }} />
                  </div>
                  <StatusDot
                    status={agent.status}
                    size="sm"
                    className="absolute -top-1 -right-1"
                  />
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium text-gray-300 truncate max-w-full">{agent.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{agent.status}</p>
                </div>
                <p className="text-xs text-gray-500">{agent.completedTasks} tasks</p>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
