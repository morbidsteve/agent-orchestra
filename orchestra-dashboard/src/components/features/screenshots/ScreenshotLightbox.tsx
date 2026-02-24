import { useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../../lib/cn.ts';
import { getScreenshotImageUrl } from '../../../lib/api.ts';
import { TerminalSnapshot } from './TerminalSnapshot.tsx';
import type { Screenshot } from '../../../lib/types.ts';

interface ScreenshotLightboxProps {
  screenshot: Screenshot;
  screenshots: Screenshot[];
  onClose: () => void;
  onNavigate: (screenshot: Screenshot) => void;
}

export function ScreenshotLightbox({
  screenshot,
  screenshots,
  onClose,
  onNavigate,
}: ScreenshotLightboxProps) {
  const sorted = [...screenshots].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  const currentIndex = sorted.findIndex((s) => s.id === screenshot.id);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < sorted.length - 1;

  const navigatePrev = useCallback(() => {
    if (hasPrev) {
      onNavigate(sorted[currentIndex - 1]);
    }
  }, [hasPrev, currentIndex, sorted, onNavigate]);

  const navigateNext = useCallback(() => {
    if (hasNext) {
      onNavigate(sorted[currentIndex + 1]);
    }
  }, [hasNext, currentIndex, sorted, onNavigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        navigatePrev();
      } else if (e.key === 'ArrowRight') {
        navigateNext();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, navigatePrev, navigateNext]);

  const formattedTime = new Date(screenshot.timestamp).toLocaleString();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Screenshot: ${screenshot.phase} - ${screenshot.milestone}`}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className={cn(
          'absolute top-4 right-4 z-50',
          'w-10 h-10 flex items-center justify-center rounded-full',
          'bg-surface-700/80 text-gray-300 hover:bg-surface-600 hover:text-white',
          'transition-colors',
        )}
        aria-label="Close lightbox"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Prev button */}
      {hasPrev && (
        <button
          type="button"
          onClick={navigatePrev}
          className={cn(
            'absolute left-4 top-1/2 -translate-y-1/2 z-50',
            'w-10 h-10 flex items-center justify-center rounded-full',
            'bg-surface-700/80 text-gray-300 hover:bg-surface-600 hover:text-white',
            'transition-colors',
          )}
          aria-label="Previous screenshot"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}

      {/* Next button */}
      {hasNext && (
        <button
          type="button"
          onClick={navigateNext}
          className={cn(
            'absolute right-4 top-1/2 -translate-y-1/2 z-50',
            'w-10 h-10 flex items-center justify-center rounded-full',
            'bg-surface-700/80 text-gray-300 hover:bg-surface-600 hover:text-white',
            'transition-colors',
          )}
          aria-label="Next screenshot"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      )}

      {/* Content area */}
      <div className="flex flex-col items-center max-w-[90vw] max-h-[90vh]">
        <div className="overflow-auto rounded-lg">
          {screenshot.type === 'terminal' ? (
            <TerminalSnapshot
              lines={screenshot.terminalLines ?? []}
              phase={screenshot.phase}
              timestamp={screenshot.timestamp}
              className="min-w-[600px] max-w-[80vw]"
            />
          ) : (
            <img
              src={screenshot.imageUrl || getScreenshotImageUrl(screenshot.id)}
              alt={`${screenshot.phase} - ${screenshot.milestone}`}
              className="max-w-[80vw] max-h-[70vh] object-contain rounded-lg"
            />
          )}
        </div>

        {/* Metadata bar */}
        <div className="mt-3 flex items-center gap-4 text-sm text-gray-400">
          <span className="px-2 py-0.5 rounded bg-accent-blue/20 text-accent-blue text-xs font-medium">
            {screenshot.phase}
          </span>
          <span>{screenshot.milestone}</span>
          <span className="text-gray-500">{formattedTime}</span>
          {sorted.length > 1 && (
            <span className="text-gray-500">
              {currentIndex + 1} / {sorted.length}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
