import { Badge } from '../../ui/Badge.tsx';
import { StreamingOutput } from './StreamingOutput.tsx';
import { formatDuration } from '../../../lib/formatters.ts';
import type { DynamicAgent } from '../../../lib/types.ts';
import {
  Code2,
  TestTube2,
  Shield,
  FileText,
  TrendingUp,
  Bot,
  Terminal,
  FileCode,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface DynamicAgentCardProps {
  agent: DynamicAgent;
}

const iconMap: Record<string, LucideIcon> = {
  Code2,
  TestTube2,
  Shield,
  FileText,
  TrendingUp,
  Bot,
  Terminal,
};

const statusVariant: Record<DynamicAgent['status'], 'success' | 'info' | 'error' | 'default'> = {
  completed: 'success',
  running: 'info',
  failed: 'error',
  pending: 'default',
};

export function DynamicAgentCard({ agent }: DynamicAgentCardProps) {
  const Icon = iconMap[agent.icon] ?? Bot;
  const agentColor = agent.color || '#6b7280';

  return (
    <div className="rounded-xl border border-surface-600 bg-surface-800">
      <div className="border-b border-surface-600 px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ backgroundColor: `${agentColor}15` }}
            >
              <Icon className="h-4 w-4" style={{ color: agentColor }} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-200">{agent.name}</p>
              <p className="text-xs text-gray-400">{agent.task}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant[agent.status]}>{agent.status}</Badge>
            <span className="text-xs text-gray-500">
              {formatDuration(agent.spawnedAt, agent.completedAt)}
            </span>
          </div>
        </div>
      </div>
      <div className="p-5">
        <StreamingOutput
          lines={agent.output}
          streaming={agent.status === 'running'}
        />
        {agent.filesModified.length > 0 && (
          <div className="mt-3 pt-3 border-t border-surface-600">
            <p className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1.5">
              <FileCode className="h-3.5 w-3.5" />
              Files Modified
            </p>
            <div className="flex flex-wrap gap-1.5">
              {agent.filesModified.map((file) => (
                <span
                  key={file}
                  className="text-xs font-mono bg-surface-700 text-gray-400 px-2 py-0.5 rounded"
                >
                  {file}
                </span>
              ))}
            </div>
          </div>
        )}
        {agent.filesRead.length > 0 && (
          <div className="mt-3 pt-3 border-t border-surface-600">
            <p className="text-xs font-medium text-gray-400 mb-2 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Files Read
            </p>
            <div className="flex flex-wrap gap-1.5">
              {agent.filesRead.map((file) => (
                <span
                  key={file}
                  className="text-xs font-mono bg-surface-700 text-gray-400 px-2 py-0.5 rounded"
                >
                  {file}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
