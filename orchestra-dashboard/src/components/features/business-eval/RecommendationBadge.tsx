import { CheckCircle, Clock, Search } from 'lucide-react';
import { cn } from '../../../lib/cn.ts';
import type { RecommendationData } from '../../../lib/types.ts';

interface RecommendationBadgeProps {
  data: RecommendationData;
}

const VERDICT_CONFIG = {
  BUILD: {
    icon: CheckCircle,
    bg: 'bg-green-500/20',
    text: 'text-green-400',
    border: 'border-green-500/30',
  },
  DEFER: {
    icon: Clock,
    bg: 'bg-amber-500/20',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
  },
  INVESTIGATE: {
    icon: Search,
    bg: 'bg-accent-blue/20',
    text: 'text-accent-blue',
    border: 'border-accent-blue/30',
  },
} as const;

export function RecommendationBadge({ data }: RecommendationBadgeProps) {
  const config = VERDICT_CONFIG[data.verdict];
  const Icon = config.icon;

  return (
    <div className="space-y-4">
      {/* Badge */}
      <div
        className={cn(
          'inline-flex items-center gap-2 rounded-lg border px-5 py-3 text-lg font-bold',
          config.bg,
          config.text,
          config.border,
        )}
      >
        <Icon className="h-6 w-6" />
        {data.verdict}
      </div>

      {/* Summary */}
      <p className="text-sm text-gray-400 leading-relaxed">{data.summary}</p>

      {/* Risks */}
      {data.risks.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Risks
          </span>
          <ul className="space-y-1.5">
            {data.risks.map((risk) => (
              <li key={risk} className="flex items-start gap-2 text-sm text-gray-400">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" />
                {risk}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next steps */}
      {data.nextSteps.length > 0 && (
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            Next Steps
          </span>
          <ul className="space-y-1.5">
            {data.nextSteps.map((step) => (
              <li key={step} className="flex items-start gap-2 text-sm text-gray-400">
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent-blue" />
                {step}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
