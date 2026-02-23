import { Link } from 'react-router-dom';
import { Card } from '../../ui/Card.tsx';
import { Badge } from '../../ui/Badge.tsx';
import { formatExecutionId, formatRelativeTime, formatDuration } from '../../../lib/formatters.ts';
import type { Execution } from '../../../lib/types.ts';
import { CheckCircle, XCircle } from 'lucide-react';

interface RecentResultsProps {
  executions: Execution[];
}

export function RecentResults({ executions }: RecentResultsProps) {
  const recent = executions.slice(0, 5);

  if (recent.length === 0) {
    return (
      <Card header={<h2 className="text-sm font-semibold text-gray-200">Recent Results</h2>}>
        <p className="text-sm text-gray-500">No completed executions yet</p>
      </Card>
    );
  }

  return (
    <Card header={<h2 className="text-sm font-semibold text-gray-200">Recent Results</h2>} noPadding>
      <div className="divide-y divide-surface-600">
        {recent.map((exec) => (
          <Link
            key={exec.id}
            to={`/executions/${exec.id}`}
            className="flex items-center gap-3 px-5 py-3 hover:bg-surface-700/50 transition-colors"
          >
            {exec.status === 'completed' ? (
              <CheckCircle className="h-4 w-4 text-green-400 shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-red-400 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-200">
                  {formatExecutionId(exec.id)}
                </span>
                <Badge variant={exec.status === 'completed' ? 'success' : 'error'}>
                  {exec.status}
                </Badge>
              </div>
              <p className="text-xs text-gray-500 truncate mt-0.5">{exec.task}</p>
            </div>
            <div className="text-right shrink-0">
              {exec.startedAt && exec.completedAt && (
                <p className="text-xs text-gray-400">{formatDuration(exec.startedAt, exec.completedAt)}</p>
              )}
              <p className="text-xs text-gray-500">{formatRelativeTime(exec.createdAt)}</p>
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}
