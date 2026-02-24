import { ExternalLink } from 'lucide-react';
import type { MarketResearchData } from '../../../lib/types.ts';

interface MarketResearchSectionProps {
  data: MarketResearchData;
}

export function MarketResearchSection({ data }: MarketResearchSectionProps) {
  return (
    <div className="rounded-lg bg-surface-700 p-4 space-y-4">
      {/* Summary */}
      <p className="text-sm text-gray-400 leading-relaxed">{data.summary}</p>

      {/* Trends */}
      {data.trends.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {data.trends.map((trend) => (
            <span
              key={trend}
              className="inline-flex items-center rounded-full bg-accent-blue/15 px-3 py-1 text-xs font-medium text-accent-blue"
            >
              {trend}
            </span>
          ))}
        </div>
      )}

      {/* Market size */}
      {data.marketSize && (
        <div className="rounded-md bg-surface-600/50 px-4 py-3">
          <span className="text-xs uppercase tracking-wider text-gray-500">Market Size</span>
          <p className="mt-1 text-lg font-semibold text-gray-200">{data.marketSize}</p>
        </div>
      )}

      {/* Sources */}
      {data.sources.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-xs uppercase tracking-wider text-gray-500">Sources</span>
          <ul className="space-y-1">
            {data.sources.map((source) => (
              <li key={source.url}>
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-accent-blue hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  {source.title}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
