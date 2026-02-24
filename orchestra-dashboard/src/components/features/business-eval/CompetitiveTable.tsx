import { Check, X } from 'lucide-react';
import { cn } from '../../../lib/cn.ts';
import type { CompetitorEntry } from '../../../lib/types.ts';

interface CompetitiveTableProps {
  competitors: CompetitorEntry[];
}

const COLUMN_HEADERS = ['Competitor', 'Has Feature', 'Approach', 'Strengths', 'Weaknesses'] as const;

export function CompetitiveTable({ competitors }: CompetitiveTableProps) {
  return (
    <div className="space-y-2">
      {/* Desktop grid header */}
      <div className="hidden md:grid md:grid-cols-5 gap-3 px-3 py-2">
        {COLUMN_HEADERS.map((header) => (
          <span key={header} className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            {header}
          </span>
        ))}
      </div>

      {/* Rows */}
      {competitors.map((competitor) => (
        <div
          key={competitor.name}
          className={cn(
            'rounded-lg bg-surface-700 p-3',
            'md:grid md:grid-cols-5 md:gap-3 md:items-start',
            'space-y-3 md:space-y-0',
          )}
        >
          {/* Competitor name */}
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 md:hidden">
              Competitor
            </span>
            <p className="text-sm font-medium text-gray-200">{competitor.name}</p>
          </div>

          {/* Has Feature */}
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 md:hidden">
              Has Feature
            </span>
            <div className="mt-0.5">
              {competitor.hasFeature ? (
                <Check className="h-5 w-5 text-green-400" />
              ) : (
                <X className="h-5 w-5 text-red-400" />
              )}
            </div>
          </div>

          {/* Approach */}
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 md:hidden">
              Approach
            </span>
            <p className="text-sm text-gray-400">{competitor.approach}</p>
          </div>

          {/* Strengths */}
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 md:hidden">
              Strengths
            </span>
            <ul className="space-y-0.5">
              {competitor.strengths.map((s) => (
                <li key={s} className="text-sm text-green-400">
                  {s}
                </li>
              ))}
            </ul>
          </div>

          {/* Weaknesses */}
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 md:hidden">
              Weaknesses
            </span>
            <ul className="space-y-0.5">
              {competitor.weaknesses.map((w) => (
                <li key={w} className="text-sm text-red-400">
                  {w}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}
    </div>
  );
}
