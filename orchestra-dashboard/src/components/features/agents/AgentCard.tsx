import { Badge } from '../../ui/Badge.tsx';
import { StatusDot } from '../../ui/StatusDot.tsx';
import { Link } from 'react-router-dom';
import type { AgentInfo } from '../../../lib/types.ts';
import { Terminal, Code, FlaskConical, Shield, Briefcase, ExternalLink, Wrench, FileText, Database, Bot, Palette, Globe, Trash2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface AgentCardProps {
  agent: AgentInfo;
  onDelete?: () => void;
}

const iconMap: Record<string, LucideIcon> = {
  Terminal,
  Code,
  FlaskConical,
  Shield,
  Briefcase,
  Wrench,
  FileText,
  Database,
  Bot,
  Palette,
  Globe,
};

export function AgentCard({ agent, onDelete }: AgentCardProps) {
  const Icon = iconMap[agent.icon] || Terminal;

  return (
    <div
      className="rounded-xl border bg-surface-800 overflow-hidden"
      style={{ borderColor: `${agent.color}30` }}
    >
      {/* Color accent top bar */}
      <div className="h-1" style={{ backgroundColor: agent.color }} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${agent.color}15` }}
            >
              <Icon className="h-5 w-5" style={{ color: agent.color }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-100">{agent.name}</h3>
                <StatusDot status={agent.status} size="sm" />
              </div>
              <p className="text-xs text-gray-500 capitalize">{agent.status}</p>
            </div>
          </div>
          {onDelete && (
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors"
              title="Delete agent"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-gray-400 mb-4">{agent.description}</p>

        {/* Capabilities */}
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Capabilities</p>
          <div className="flex flex-wrap gap-1.5">
            {agent.capabilities.map((cap) => (
              <Badge key={cap} variant="default">{cap}</Badge>
            ))}
          </div>
        </div>

        {/* Tools */}
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Tools</p>
          <div className="flex flex-wrap gap-1.5">
            {agent.tools.map((tool) => (
              <span
                key={tool}
                className="text-xs font-mono bg-surface-700 text-gray-400 px-2 py-0.5 rounded border border-surface-600"
              >
                {tool}
              </span>
            ))}
          </div>
        </div>

        {/* Stats + Current Task */}
        <div className="border-t border-surface-600 pt-3 flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span>{agent.completedTasks} tasks completed</span>
            <span>{agent.successRate}% success rate</span>
          </div>
          {agent.currentExecution && (
            <Link
              to={`/executions/${agent.currentExecution}`}
              className="flex items-center gap-1 text-xs text-accent-blue hover:underline"
            >
              Active task <ExternalLink className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
