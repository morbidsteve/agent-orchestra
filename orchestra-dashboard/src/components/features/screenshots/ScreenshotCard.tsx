import { cn } from '../../../lib/cn.ts';
import { getScreenshotImageUrl } from '../../../lib/api.ts';
import type { Screenshot } from '../../../lib/types.ts';

interface ScreenshotCardProps {
  screenshot: Screenshot;
  onSelect: (screenshot: Screenshot) => void;
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

export function ScreenshotCard({ screenshot, onSelect }: ScreenshotCardProps) {
  const formattedTime = new Date(screenshot.timestamp).toLocaleTimeString();

  return (
    <button
      type="button"
      onClick={() => onSelect(screenshot)}
      className={cn(
        'relative flex-shrink-0 w-48 h-32 rounded-lg overflow-hidden',
        'border border-surface-600 bg-surface-800',
        'transition-all duration-200 cursor-pointer',
        'hover:scale-105 hover:border-accent-blue hover:shadow-lg hover:shadow-accent-blue/10',
        'focus:outline-none focus:ring-2 focus:ring-accent-blue focus:ring-offset-2 focus:ring-offset-surface-900',
      )}
    >
      {/* Phase badge */}
      <span className="absolute top-1.5 left-1.5 z-10 px-1.5 py-0.5 text-[10px] font-medium rounded bg-accent-blue/80 text-white">
        {screenshot.phase}
      </span>

      {/* Content area */}
      <div className="w-full h-full flex flex-col">
        {screenshot.type === 'browser' ? (
          <img
            src={screenshot.imageUrl || getScreenshotImageUrl(screenshot.id)}
            alt={`${screenshot.phase} - ${screenshot.milestone}`}
            className="w-full h-full object-cover"
          />
        ) : (
          /* Mini terminal preview */
          <div className="flex-1 bg-surface-900 p-1.5 pt-4 overflow-hidden">
            {/* Mini dots */}
            <div className="flex items-center gap-0.5 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500/70" />
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500/70" />
              <span className="w-1.5 h-1.5 rounded-full bg-green-500/70" />
            </div>
            <pre className="text-[6px] font-mono leading-tight overflow-hidden">
              {(screenshot.terminalLines ?? []).slice(0, 8).map((line, i) => (
                <div key={i} className={cn('truncate', getLineClassName(line))}>
                  {line || '\u00A0'}
                </div>
              ))}
            </pre>
          </div>
        )}

        {/* Timestamp bar */}
        <div className="px-2 py-1 bg-surface-800 border-t border-surface-600 text-[10px] text-gray-400 text-center truncate">
          {formattedTime}
        </div>
      </div>
    </button>
  );
}
