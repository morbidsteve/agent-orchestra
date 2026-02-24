import { cn } from '../../../lib/cn.ts';

interface TerminalSnapshotProps {
  lines: string[];
  phase: string;
  timestamp: string;
  className?: string;
}

function getLineClassName(line: string): string {
  if (line.startsWith('$')) return 'text-accent-blue';
  if (line.startsWith('PASS')) return 'text-green-400';
  if (line.startsWith('FAIL')) return 'text-red-400';
  if (line.includes('CRITICAL')) return 'text-red-400 font-bold';
  if (line.includes('error')) return 'text-red-400';
  if (line.includes('FINDING')) return 'text-orange-400';
  return 'text-gray-400';
}

export function TerminalSnapshot({ lines, phase, timestamp, className }: TerminalSnapshotProps) {
  const formattedTime = new Date(timestamp).toLocaleTimeString();

  return (
    <div className={cn('rounded-lg overflow-hidden border border-surface-600 bg-surface-900', className)}>
      {/* Title bar with window chrome */}
      <div className="flex items-center gap-2 px-3 py-2 bg-surface-800 border-b border-surface-600">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-full bg-red-500" />
          <span className="w-3 h-3 rounded-full bg-yellow-500" />
          <span className="w-3 h-3 rounded-full bg-green-500" />
        </div>
        <span className="ml-2 text-xs text-gray-400 font-mono truncate">
          {phase} &mdash; {formattedTime}
        </span>
      </div>

      {/* Terminal body */}
      <div className="p-4 overflow-y-auto max-h-[70vh]">
        <pre className="text-xs font-mono leading-relaxed">
          {lines.map((line, i) => (
            <div key={i} className={cn('py-0.5', getLineClassName(line))}>
              {line || '\u00A0'}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
