import { useState } from 'react';
import { Link } from 'react-router-dom';
import { SeverityBadge } from './SeverityBadge.tsx';
import { Badge } from '../../ui/Badge.tsx';
import { cn } from '../../../lib/cn.ts';
import { formatDate, formatExecutionId } from '../../../lib/formatters.ts';
import type { Finding } from '../../../lib/types';
import { ChevronDown, ChevronRight, FileCode, Wrench } from 'lucide-react';

interface FindingsTableProps {
  findings: Finding[];
}

const statusBadgeVariant = {
  open: 'warning' as const,
  resolved: 'success' as const,
  dismissed: 'default' as const,
};

export function FindingsTable({ findings }: FindingsTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (findings.length === 0) {
    return (
      <div className="rounded-xl border border-surface-600 bg-surface-800 p-8 text-center">
        <p className="text-gray-400">No findings match the current filters</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-surface-600 bg-surface-800 overflow-hidden">
      {/* Table Header */}
      <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-5 py-3 border-b border-surface-600 text-xs font-medium text-gray-500 uppercase tracking-wider">
        <span className="w-5" />
        <span>Finding</span>
        <span>Severity</span>
        <span>Type</span>
        <span>Status</span>
        <span>Execution</span>
      </div>

      {/* Rows */}
      <div className="divide-y divide-surface-600">
        {findings.map((finding) => {
          const isExpanded = expandedId === finding.id;

          return (
            <div key={finding.id}>
              <button
                onClick={() => setExpandedId(isExpanded ? null : finding.id)}
                className={cn(
                  'w-full grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-5 py-3 text-left hover:bg-surface-700/50 transition-colors items-center',
                )}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-gray-400" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                )}
                <div className="min-w-0">
                  <p className="text-sm text-gray-200 truncate">{finding.title}</p>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {finding.file}{finding.line ? `:${finding.line}` : ''}
                  </p>
                </div>
                <SeverityBadge severity={finding.severity} />
                <Badge variant="default">{finding.type}</Badge>
                <Badge variant={statusBadgeVariant[finding.status]}>{finding.status}</Badge>
                <Link
                  to={`/executions/${finding.executionId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs text-accent-blue hover:underline"
                >
                  {formatExecutionId(finding.executionId)}
                </Link>
              </button>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="px-5 pb-4 pt-0 ml-9 border-l-2 border-surface-600 space-y-3">
                  <div>
                    <p className="text-xs font-medium text-gray-400 mb-1">Description</p>
                    <p className="text-sm text-gray-300">{finding.description}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-400 mb-1 flex items-center gap-1.5">
                      <Wrench className="h-3.5 w-3.5" />
                      Remediation
                    </p>
                    <p className="text-sm text-gray-300">{finding.remediation}</p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <FileCode className="h-3.5 w-3.5" />
                      {finding.file}{finding.line ? `:${finding.line}` : ''}
                    </span>
                    <span>Found by: {finding.agent}</span>
                    <span>{formatDate(finding.createdAt)}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
