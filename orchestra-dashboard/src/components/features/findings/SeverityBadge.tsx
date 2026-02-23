import { cn } from '../../../lib/cn.ts';
import { SEVERITY_CONFIG } from '../../../lib/constants.ts';
import type { FindingSeverity } from '../../../lib/types';

interface SeverityBadgeProps {
  severity: FindingSeverity;
  className?: string;
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const config = SEVERITY_CONFIG[severity];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        config.bg,
        config.color,
        className,
      )}
    >
      {config.label}
    </span>
  );
}
