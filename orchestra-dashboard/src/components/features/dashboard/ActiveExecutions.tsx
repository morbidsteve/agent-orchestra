import { Link } from 'react-router-dom';
import { Card } from '../../ui/Card.tsx';
import { Badge } from '../../ui/Badge.tsx';
import { ProgressBar } from '../../ui/ProgressBar.tsx';
import { formatExecutionId, formatDuration } from '../../../lib/formatters.ts';
import type { Execution } from '../../../lib/types.ts';
import { Clock } from 'lucide-react';

interface ActiveExecutionsProps {
  executions: Execution[];
}

const statusToBadge = {
  running: 'success' as const,
  queued: 'default' as const,
  completed: 'info' as const,
  failed: 'error' as const,
};

export function ActiveExecutions({ executions }: ActiveExecutionsProps) {
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
        {executions.map((exec) => (
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
            <ProgressBar steps={exec.pipeline} />
          </Link>
        ))}
      </div>
    </Card>
  );
}
