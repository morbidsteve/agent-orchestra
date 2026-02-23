import { cn } from '../../lib/cn.ts';
import type { SelectHTMLAttributes } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
}

export function Select({ label, className, children, id, ...props }: SelectProps) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1.5">
          {label}
        </label>
      )}
      <select
        id={id}
        className={cn(
          'w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-sm text-gray-200',
          'focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue',
          className,
        )}
        {...props}
      >
        {children}
      </select>
    </div>
  );
}
