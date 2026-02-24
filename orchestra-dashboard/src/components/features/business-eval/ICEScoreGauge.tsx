import { useState, useEffect } from 'react';
import { cn } from '../../../lib/cn.ts';
import type { ICEScoreData } from '../../../lib/types.ts';

interface ICEScoreGaugeProps {
  data: ICEScoreData;
}

function getBarColor(value: number): string {
  if (value <= 3) return 'bg-red-500';
  if (value <= 6) return 'bg-amber-500';
  return 'bg-green-500';
}

function getTotalColor(total: number): string {
  // Total is out of 30 (3 dimensions * 10 each)
  if (total <= 9) return 'text-red-400';
  if (total <= 18) return 'text-amber-400';
  return 'text-green-400';
}

interface GaugeBarProps {
  label: string;
  value: number;
  animated: boolean;
}

function GaugeBar({ label, value, animated }: GaugeBarProps) {
  const widthPercent = (value / 10) * 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-400">{label}</span>
        <span className="text-xs font-semibold text-gray-300">{value}/10</span>
      </div>
      <div className="h-3 w-full rounded-full bg-surface-600">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-1000 ease-out',
            getBarColor(value),
          )}
          style={{ width: animated ? `${widthPercent}%` : '0%' }}
        />
      </div>
    </div>
  );
}

export function ICEScoreGauge({ data }: ICEScoreGaugeProps) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    // Trigger animation after mount
    const timer = requestAnimationFrame(() => {
      setAnimated(true);
    });
    return () => cancelAnimationFrame(timer);
  }, []);

  return (
    <div className="space-y-4">
      {/* Gauge bars */}
      <div className="space-y-3">
        <GaugeBar label="Impact" value={data.impact} animated={animated} />
        <GaugeBar label="Confidence" value={data.confidence} animated={animated} />
        <GaugeBar label="Ease" value={data.ease} animated={animated} />
      </div>

      {/* Total score */}
      <div className="rounded-lg bg-surface-700 px-4 py-3 text-center">
        <span className="text-xs uppercase tracking-wider text-gray-500">Total Score</span>
        <p className={cn('mt-1 text-3xl font-bold', getTotalColor(data.total))}>
          {data.total}
          <span className="text-base font-normal text-gray-500">/30</span>
        </p>
      </div>

      {/* Reasoning */}
      {data.reasoning && (
        <p className="text-sm text-gray-400 leading-relaxed">{data.reasoning}</p>
      )}
    </div>
  );
}
