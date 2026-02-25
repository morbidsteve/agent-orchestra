import { Card } from '../../ui/Card.tsx';
import { StatusDot } from '../../ui/StatusDot.tsx';
import type { AgentInfo } from '../../../lib/types.ts';
import {
  Terminal,
  Code,
  FlaskConical,
  Shield,
  Briefcase,
  Palette,
  Server,
  Container,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface AgentStatusGridProps {
  agents: AgentInfo[];
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

export function AgentStatusGrid({ agents }: AgentStatusGridProps) {
  return (
    <Card header={<h2 className="text-sm font-semibold text-gray-200">Agent Status</h2>}>
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
    </Card>
  );
}
