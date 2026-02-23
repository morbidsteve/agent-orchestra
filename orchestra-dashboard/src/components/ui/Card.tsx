import { cn } from '../../lib/cn.ts';
import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  header?: ReactNode;
  footer?: ReactNode;
  noPadding?: boolean;
}

export function Card({ header, footer, noPadding, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-surface-600 bg-surface-800',
        className,
      )}
      {...props}
    >
      {header && (
        <div className="border-b border-surface-600 px-5 py-3">
          {header}
        </div>
      )}
      <div className={cn(!noPadding && 'p-5')}>
        {children}
      </div>
      {footer && (
        <div className="border-t border-surface-600 px-5 py-3">
          {footer}
        </div>
      )}
    </div>
  );
}
