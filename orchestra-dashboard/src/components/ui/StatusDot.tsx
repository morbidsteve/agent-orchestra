import { cn } from '../../lib/cn.ts';
import type { AgentStatus } from '../../lib/types.ts';

interface StatusDotProps {
  status: AgentStatus;
  size?: 'sm' | 'md';
  className?: string;
}

const dotColors: Record<AgentStatus, string> = {
  idle: 'bg-gray-400',
  busy: 'bg-green-400',
  offline: 'bg-red-400',
};

export function StatusDot({ status, size = 'md', className }: StatusDotProps) {
  const sizeClass = size === 'sm' ? 'h-2 w-2' : 'h-3 w-3';

  return (
    <span className={cn('relative inline-flex', className)}>
      {status === 'busy' && (
        <span
          className={cn(
            'absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75',
          )}
        />
      )}
      <span
        className={cn(
          'relative inline-flex rounded-full',
          sizeClass,
          dotColors[status],
        )}
      />
    </span>
  );
}
