import { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
import { cn } from '../../../lib/cn.ts';
import { getScreenshotImageUrl } from '../../../lib/api.ts';
import { TerminalSnapshot } from './TerminalSnapshot.tsx';
import type { Screenshot } from '../../../lib/types.ts';

interface ScreenshotCarouselProps {
  screenshots: Screenshot[];
  onViewFull?: (screenshot: Screenshot) => void;
}

const AUTO_ADVANCE_INTERVAL = 5000;

export function ScreenshotCarousel({ screenshots, onViewFull }: ScreenshotCarouselProps) {
  const [rawIndex, setRawIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sorted = [...screenshots].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const count = sorted.length;

  // Derive a clamped index from raw state without an effect
  const currentIndex = count === 0 ? 0 : Math.min(rawIndex, count - 1);

  const goTo = useCallback(
    (index: number) => {
      if (count === 0) return;
      setRawIndex(((index % count) + count) % count);
    },
    [count],
  );

  const goNext = useCallback(() => goTo(currentIndex + 1), [currentIndex, goTo]);
  const goPrev = useCallback(() => goTo(currentIndex - 1), [currentIndex, goTo]);

  // Auto-advance timer
  useEffect(() => {
    if (isPaused || count <= 1) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setRawIndex((prev) => (prev + 1) % count);
    }, AUTO_ADVANCE_INTERVAL);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [isPaused, count]);

  if (count === 0) {
    return (
      <div className="flex items-center justify-center py-6 text-gray-500 text-sm">
        No screenshots available
      </div>
    );
  }

  const current = sorted[currentIndex];

  return (
    <div
      className="relative rounded-lg border border-surface-600 bg-surface-800 overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {/* Screenshot content */}
      <div className="relative min-h-[160px]">
        {current.type === 'terminal' ? (
          <TerminalSnapshot
            lines={(current.terminalLines ?? []).slice(0, 12)}
            phase={current.phase}
            timestamp={current.timestamp}
            className="rounded-none border-0"
          />
        ) : (
          <img
            src={current.imageUrl || getScreenshotImageUrl(current.id)}
            alt={`${current.phase} - ${current.milestone}`}
            className="w-full h-40 object-cover"
          />
        )}

        {/* View full button */}
        {onViewFull && (
          <button
            type="button"
            onClick={() => onViewFull(current)}
            className={cn(
              'absolute top-2 right-2 z-10',
              'w-7 h-7 flex items-center justify-center rounded',
              'bg-surface-800/80 text-gray-400 hover:bg-surface-700 hover:text-white',
              'transition-colors opacity-0 group-hover:opacity-100',
              'hover:opacity-100',
            )}
            aria-label="View full screenshot"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Prev / Next buttons */}
        {count > 1 && (
          <>
            <button
              type="button"
              onClick={goPrev}
              className={cn(
                'absolute left-1 top-1/2 -translate-y-1/2 z-10',
                'w-6 h-6 flex items-center justify-center rounded-full',
                'bg-surface-800/80 text-gray-400 hover:bg-surface-700 hover:text-white',
                'transition-colors',
              )}
              aria-label="Previous screenshot"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={goNext}
              className={cn(
                'absolute right-1 top-1/2 -translate-y-1/2 z-10',
                'w-6 h-6 flex items-center justify-center rounded-full',
                'bg-surface-800/80 text-gray-400 hover:bg-surface-700 hover:text-white',
                'transition-colors',
              )}
              aria-label="Next screenshot"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>

      {/* Footer: count + dot indicators */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-surface-600">
        <span className="text-xs text-gray-500">
          {currentIndex + 1} / {count}
        </span>

        {count > 1 && (
          <div className="flex items-center gap-1">
            {sorted.map((s, i) => (
              <button
                key={s.id}
                type="button"
                onClick={() => goTo(i)}
                className={cn(
                  'w-1.5 h-1.5 rounded-full transition-colors',
                  i === currentIndex ? 'bg-accent-blue' : 'bg-surface-600 hover:bg-surface-500',
                )}
                aria-label={`Go to screenshot ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
