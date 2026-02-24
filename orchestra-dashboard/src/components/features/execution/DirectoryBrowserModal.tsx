import { useState, useEffect, useCallback } from 'react';
import { X, Folder, ChevronUp, Loader2 } from 'lucide-react';
import { browseFilesystem } from '../../../lib/api.ts';

interface DirectoryBrowserModalProps {
  onClose: () => void;
  onSelect: (path: string) => void;
  initialPath?: string;
}

export function DirectoryBrowserModal({ onClose, onSelect, initialPath }: DirectoryBrowserModalProps) {
  const [currentPath, setCurrentPath] = useState(initialPath || '/');
  const [directories, setDirectories] = useState<string[]>([]);
  const [parent, setParent] = useState<string | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState(initialPath || '/');

  const loadDirectory = useCallback(async (path?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await browseFilesystem(path);
      setCurrentPath(result.current);
      setDirectories(result.directories);
      setParent(result.parent);
      setTruncated(result.truncated);
      setInputValue(result.current);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to browse directory');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDirectory(initialPath);
  }, [initialPath, loadDirectory]);

  const navigateTo = (path: string) => {
    loadDirectory(path);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      navigateTo(inputValue);
    }
  };

  const breadcrumbSegments = currentPath.split('/').filter(Boolean);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg rounded-xl border border-surface-600 bg-surface-800 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-600 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-100">Browse Directory</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-surface-700 transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Path input */}
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Enter a path and press Enter"
            className="w-full rounded-lg border border-surface-600 bg-surface-700 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:border-accent-blue focus:outline-none"
          />

          {/* Breadcrumb bar */}
          <div className="flex flex-wrap items-center gap-1 text-sm text-gray-400">
            <button
              onClick={() => navigateTo('/')}
              className="hover:text-accent-blue transition-colors"
            >
              /
            </button>
            {breadcrumbSegments.map((segment, index) => {
              const path = '/' + breadcrumbSegments.slice(0, index + 1).join('/');
              return (
                <span key={path} className="flex items-center gap-1">
                  <span className="text-gray-600">/</span>
                  <button
                    onClick={() => navigateTo(path)}
                    className="hover:text-accent-blue transition-colors"
                  >
                    {segment}
                  </button>
                </span>
              );
            })}
          </div>

          {/* Directory list */}
          <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-surface-600">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <p className="text-sm text-red-400">{error}</p>
                <button
                  onClick={() => loadDirectory(currentPath)}
                  className="rounded-lg border border-surface-600 px-3 py-1.5 text-sm text-gray-300 hover:bg-surface-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : (
              <div>
                {parent !== null && (
                  <button
                    onClick={() => navigateTo(parent)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-surface-700 transition-colors border-b border-surface-600"
                  >
                    <ChevronUp className="h-4 w-4 text-gray-500" />
                    <span>..</span>
                  </button>
                )}
                {directories.length === 0 && (
                  <div className="flex items-center justify-center py-8">
                    <p className="text-sm text-gray-500">No subdirectories</p>
                  </div>
                )}
                {directories.map((dir) => (
                  <button
                    key={dir}
                    onClick={() => navigateTo(currentPath === '/' ? `/${dir}` : `${currentPath}/${dir}`)}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-surface-700 transition-colors"
                  >
                    <Folder className="h-4 w-4 text-accent-blue" />
                    <span>{dir}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Truncation warning */}
          {truncated && (
            <p className="text-xs text-amber-400">Showing first 200 directories</p>
          )}

          {/* Info note */}
          <p className="text-xs text-gray-500">
            Browsing server filesystem. Mount host directories with docker -v to see them here.
          </p>
        </div>

        {/* Footer actions */}
        <div className="flex justify-end gap-3 border-t border-surface-600 px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-lg border border-surface-600 px-4 py-2 text-sm text-gray-300 hover:bg-surface-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onSelect(currentPath)}
            className="rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white hover:bg-accent-blue/90 transition-colors"
          >
            Select
          </button>
        </div>
      </div>
    </div>
  );
}
