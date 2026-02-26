import { Link } from 'react-router-dom';
import { Card } from '../../ui/Card.tsx';
import { Badge } from '../../ui/Badge.tsx';
import { ProgressBar } from '../../ui/ProgressBar.tsx';
import { formatExecutionId, formatDuration } from '../../../lib/formatters.ts';
import { cn } from '../../../lib/cn.ts';
import type { Execution, DynamicAgent } from '../../../lib/types.ts';
import { Clock, CheckCircle, XCircle } from 'lucide-react';

interface ActiveExecutionsProps {
  executions: Execution[];
  agentsByExecution?: Map<string, DynamicAgent[]>;
}

const statusToBadge = {
  running: 'success' as const,
  queued: 'default' as const,
  completed: 'info' as const,
  failed: 'error' as const,
};

export function ActiveExecutions({ executions, agentsByExecution }: ActiveExecutionsProps) {
  if (executions.length === 0) {
    return (
      <Card header={<h2 className="text-sm font-semibold text-gray-200">Active Executions</h2>}>
        <p className="text-sm text-gray-500">No active executions</p>
      </Card>
    );
  }

  return (
    <Card header={<h2 className="text-sm font-semibold text-gray-200">Active Executions</h2>} noPadding>
      <div className="divide-y divide-surface-600">
        {executions.map((exec) => {
          const agents = agentsByExecution?.get(exec.id);
          return (
            <Link
              key={exec.id}
              to={`/executions/${exec.id}`}
              className="block px-5 py-4 hover:bg-surface-700/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-200">
                    {formatExecutionId(exec.id)}
                  </span>
                  <Badge variant={statusToBadge[exec.status]}>
                    {exec.status}
                  </Badge>
                </div>
                {exec.startedAt && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="h-3 w-3" />
                    {formatDuration(exec.startedAt, exec.completedAt)}
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-400 mb-3 truncate">{exec.task}</p>
              {agents && agents.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {agents.map((agent) => (
                    <span
                      key={agent.id}
                      className="inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 bg-surface-700"
                    >
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          agent.status === 'running' && 'animate-pulse',
                        )}
                        style={{ backgroundColor: agent.color }}
                      />
                      <span className="text-gray-400 truncate max-w-[80px]">{agent.name}</span>
                      {agent.status === 'completed' && (
                        <CheckCircle className="h-3 w-3 text-green-400" />
                      )}
                      {agent.status === 'failed' && (
                        <XCircle className="h-3 w-3 text-red-400" />
                      )}
                    </span>
                  ))}
                </div>
              ) : (
                <ProgressBar steps={exec.pipeline} />
              )}
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
