import { cn } from '../../lib/cn.ts';
import type { TextareaHTMLAttributes } from 'react';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function TextArea({ label, className, id, ...props }: TextAreaProps) {
  return (
    <div>
      {label && (
        <label htmlFor={id} className="block text-sm font-medium text-gray-300 mb-1.5">
          {label}
        </label>
      )}
      <textarea
        id={id}
        className={cn(
          'w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-sm text-gray-200',
          'focus:outline-none focus:ring-2 focus:ring-accent-blue/50 focus:border-accent-blue',
          'placeholder:text-gray-500 resize-none',
          className,
        )}
        {...props}
      />
    </div>
  );
}
