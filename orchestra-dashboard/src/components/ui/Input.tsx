import { cn } from '../../lib/cn.ts';
import type { InputHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className, id, ...props }: InputProps) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1.5">
          {label}
        </label>
      )}
      <input
        id={id}
        className={cn(
          'w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-sm text-gray-200',
          'focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue',
          'placeholder:text-gray-500',
          className,
        )}
        {...props}
      />
    </div>
  );
}
