import { useRef, useEffect } from 'react';
import { cn } from '../../../lib/cn.ts';

interface StreamingOutputProps {
  lines: string[];
  className?: string;
  streaming?: boolean;
}

export function StreamingOutput({ lines, className, streaming }: StreamingOutputProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines.length]);

  if (lines.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className={cn('rounded-lg bg-surface-900 border border-surface-600 p-4 max-h-64 overflow-y-auto', className)}
    >
      <pre className="text-xs font-mono leading-relaxed">
        {lines.map((line, i) => (
          <div key={i} className={cn(
            'py-0.5',
            line.startsWith('$') && 'text-accent-blue',
            line.startsWith('PASS') && 'text-green-400',
            line.startsWith('FAIL') && 'text-red-400',
            line.includes('error') && 'text-red-400',
            line.includes('CRITICAL') && 'text-red-400 font-semibold',
            line.includes('FINDING') && 'text-orange-400',
            !line.startsWith('$') && !line.startsWith('PASS') && !line.startsWith('FAIL') && !line.includes('error') && !line.includes('CRITICAL') && !line.includes('FINDING') && 'text-gray-400',
          )}>
            {line || '\u00A0'}
          </div>
        ))}
        {streaming && (
          <div className="py-0.5 text-accent-blue">
            <span className="inline-block w-2 h-3.5 bg-accent-blue animate-pulse" />
          </div>
        )}
      </pre>
    </div>
  );
}
