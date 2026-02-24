import { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Camera } from 'lucide-react';
import { cn } from '../../../lib/cn.ts';
import { ScreenshotCard } from './ScreenshotCard.tsx';
import type { Screenshot } from '../../../lib/types.ts';

interface ScreenshotTimelineProps {
  screenshots: Screenshot[];
  onSelect: (screenshot: Screenshot) => void;
}

export function ScreenshotTimeline({ screenshots, onSelect }: ScreenshotTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const sorted = [...screenshots].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const checkOverflow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    checkOverflow();
    const el = scrollRef.current;
    if (!el) return;

    el.addEventListener('scroll', checkOverflow, { passive: true });
    const resizeObserver = new ResizeObserver(checkOverflow);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener('scroll', checkOverflow);
      resizeObserver.disconnect();
    };
  }, [checkOverflow, sorted.length]);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.clientWidth * 0.75;
    el.scrollBy({
      left: direction === 'left' ? -distance : distance,
      behavior: 'smooth',
    });
  };

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-gray-500">
        <Camera className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm">No screenshots yet</p>
      </div>
    );
  }

  return (
    <div className="relative group">
      {/* Left scroll button */}
      {canScrollLeft && (
        <button
          type="button"
          onClick={() => scroll('left')}
          className={cn(
            'absolute left-0 top-1/2 -translate-y-1/2 z-10',
            'w-8 h-8 flex items-center justify-center rounded-full',
            'bg-surface-700/90 border border-surface-600 text-gray-300',
            'hover:bg-surface-600 hover:text-white transition-colors',
            'opacity-0 group-hover:opacity-100 transition-opacity',
          )}
          aria-label="Scroll left"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      {/* Scrollable container */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scrollbar-thin px-1 py-2"
        style={{ scrollbarWidth: 'thin' }}
      >
        {sorted.map((screenshot) => (
          <ScreenshotCard
            key={screenshot.id}
            screenshot={screenshot}
            onSelect={onSelect}
          />
        ))}
      </div>

      {/* Right scroll button */}
      {canScrollRight && (
        <button
          type="button"
          onClick={() => scroll('right')}
          className={cn(
            'absolute right-0 top-1/2 -translate-y-1/2 z-10',
            'w-8 h-8 flex items-center justify-center rounded-full',
            'bg-surface-700/90 border border-surface-600 text-gray-300',
            'hover:bg-surface-600 hover:text-white transition-colors',
            'opacity-0 group-hover:opacity-100 transition-opacity',
          )}
          aria-label="Scroll right"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
