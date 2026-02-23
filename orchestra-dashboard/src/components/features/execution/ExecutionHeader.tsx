import { Badge } from '../../ui/Badge.tsx';
import { formatExecutionId, formatDate, formatDuration } from '../../../lib/formatters.ts';
import { cn } from '../../../lib/cn.ts';
import { Link } from 'react-router-dom';
import { ArrowLeft, Clock, GitBranch, Cpu, FolderOpen, Globe } from 'lucide-react';
import type { Execution } from '../../../lib/types.ts';

interface ExecutionHeaderProps {
  execution: Execution;
}

const statusVariant = {
  running: 'success' as const,
  completed: 'info' as const,
  failed: 'error' as const,
  queued: 'default' as const,
};

export function ExecutionHeader({ execution }: ExecutionHeaderProps) {
  return (
    <div>
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors mb-4">
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-gray-100">
              Execution {formatExecutionId(execution.id)}
            </h1>
            <Badge variant={statusVariant[execution.status]}>
              {execution.status}
            </Badge>
          </div>
          <p className="text-gray-300 text-lg">{execution.task}</p>
        </div>
      </div>

      <div className={cn('flex items-center gap-6 mt-4 text-sm text-gray-400')}>
        <div className="flex items-center gap-1.5">
          <GitBranch className="h-4 w-4" />
          <span className="capitalize">{execution.workflow.replace('-', ' ')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Cpu className="h-4 w-4" />
          <span>{execution.model}</span>
        </div>
        {execution.projectSource && (
          <div className="flex items-center gap-1.5">
            {execution.projectSource.type === 'git' ? (
              <Globe className="h-4 w-4" />
            ) : (
              <FolderOpen className="h-4 w-4" />
            )}
            <span>
              {execution.resolvedProjectPath || execution.projectSource.path || 'New project'}
            </span>
          </div>
        )}
        {execution.target && (
          <div className="flex items-center gap-1.5">
            <FolderOpen className="h-4 w-4" />
            <span>{execution.target}</span>
          </div>
        )}
        {execution.startedAt && (
          <div className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            <span>{formatDuration(execution.startedAt, execution.completedAt)}</span>
          </div>
        )}
        <span className="text-gray-500">{formatDate(execution.createdAt)}</span>
      </div>
    </div>
  );
}
