import { useState, useEffect } from 'react';
import {
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle,
  Tag,
  ChevronDown,
  GitBranch,
} from 'lucide-react';
import {
  triggerSystemUpdate,
  fetchSystemTags,
  type SystemTag,
} from '../../../lib/api.ts';

type UpdateStatus = 'idle' | 'updating' | 'success' | 'error';
type LoadingState = 'loading' | 'loaded' | 'error';

export function UpdateCard() {
  const [status, setStatus] = useState<UpdateStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Tag data
  const [loadingState, setLoadingState] = useState<LoadingState>('loading');
  const [tags, setTags] = useState<SystemTag[]>([]);
  const [currentTag, setCurrentTag] = useState<string | null>(null);
  const [currentCommit, setCurrentCommit] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    fetchSystemTags().then(
      (data) => {
        if (cancelled) return;
        setTags(data.tags);
        setCurrentTag(data.current_tag);
        setCurrentCommit(data.current_commit);
        setSelectedTag(data.current_tag ?? '');
        setLoadingState('loaded');
      },
      () => {
        if (!cancelled) setLoadingState('error');
      },
    );
    return () => { cancelled = true; };
  }, []);

  const handleSwitchVersion = async () => {
    if (!selectedTag || selectedTag === currentTag) return;
    setStatus('updating');
    setErrorMessage(null);
    try {
      const result = await triggerSystemUpdate(selectedTag);
      if (result.status === 'ok') {
        setStatus('success');
        setTimeout(() => window.location.reload(), 3000);
      } else {
        setStatus('error');
        setErrorMessage(result.message ?? 'Version switch failed');
      }
    } catch {
      // Backend may have restarted -- treat fetch errors as success
      setStatus('success');
      setTimeout(() => window.location.reload(), 3000);
    }
  };

  const handleUpdateLatest = async () => {
    setStatus('updating');
    setErrorMessage(null);
    try {
      const result = await triggerSystemUpdate();
      if (result.status === 'ok') {
        setStatus('success');
        setTimeout(() => window.location.reload(), 3000);
      } else {
        setStatus('error');
        setErrorMessage(result.message ?? 'Update failed');
      }
    } catch {
      // Backend may have restarted -- treat fetch errors as success
      setStatus('success');
      setTimeout(() => window.location.reload(), 3000);
    }
  };

  const currentVersionLabel = currentTag
    ? currentTag
    : currentCommit
      ? `${currentCommit.slice(0, 7)} (untagged)`
      : 'Unknown';

  const canSwitch =
    status === 'idle' && selectedTag !== '' && selectedTag !== currentTag;

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loadingState === 'loading') {
    return (
      <div className="rounded-xl border border-surface-600 bg-surface-800 p-6">
        <div className="flex items-center gap-3 mb-4">
          <RefreshCw className="h-6 w-6 text-gray-100" />
          <div>
            <h2 className="text-lg font-semibold text-gray-100">
              System Update
            </h2>
            <p className="text-sm text-gray-400">
              Manage version and pull updates
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading available versions...
        </div>
      </div>
    );
  }

  // ── Error loading tags / empty tags fallback ───────────────────────────────
  const hasTags = tags.length > 0;

  if (loadingState === 'error' || !hasTags) {
    return (
      <div className="rounded-xl border border-surface-600 bg-surface-800 p-6">
        <div className="flex items-center gap-3 mb-4">
          <RefreshCw className="h-6 w-6 text-gray-100" />
          <div>
            <h2 className="text-lg font-semibold text-gray-100">
              System Update
            </h2>
            <p className="text-sm text-gray-400">
              Pull the latest code and restart services
            </p>
          </div>
        </div>

        {loadingState === 'error' && (
          <p className="mb-3 text-sm text-gray-500">
            Could not load version tags. You can still update to the latest
            code.
          </p>
        )}

        {loadingState === 'loaded' && !hasTags && (
          <p className="mb-3 text-sm text-gray-500">
            No tagged versions found. You can update to the latest code on
            master.
          </p>
        )}

        {status === 'idle' && (
          <button
            onClick={() => void handleUpdateLatest()}
            className="rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white hover:bg-accent-blue/80 transition-colors"
          >
            Update Now
          </button>
        )}

        {status === 'updating' && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Pulling latest code...
          </div>
        )}

        {status === 'success' && (
          <div className="flex items-center gap-2 text-sm text-green-400">
            <CheckCircle className="h-4 w-4" />
            Update complete, reloading...
          </div>
        )}

        {status === 'error' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {errorMessage}
            </div>
            <button
              onClick={() => setStatus('idle')}
              className="rounded-lg bg-accent-blue px-4 py-2 text-sm font-medium text-white hover:bg-accent-blue/80 transition-colors"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Full version switcher UI ───────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-surface-600 bg-surface-800 p-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <RefreshCw className="h-6 w-6 text-gray-100" />
        <div>
          <h2 className="text-lg font-semibold text-gray-100">
            System Update
          </h2>
          <p className="text-sm text-gray-400">
            Manage version and pull updates
          </p>
        </div>
      </div>

      {/* Current version */}
      <div className="mb-4 flex items-center gap-2 text-sm">
        <Tag className="h-4 w-4 text-gray-400" />
        <span className="text-gray-400">Current Version:</span>
        <span className="font-medium text-gray-100">{currentVersionLabel}</span>
      </div>

      {/* Status messages (shown during/after an update action) */}
      {status === 'updating' && (
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          {selectedTag && selectedTag !== currentTag
            ? `Switching to ${selectedTag}...`
            : 'Pulling latest code...'}
        </div>
      )}

      {status === 'success' && (
        <div className="mb-4 flex items-center gap-2 text-sm text-green-400">
          <CheckCircle className="h-4 w-4" />
          Update complete, reloading...
        </div>
      )}

      {status === 'error' && (
        <div className="mb-4 space-y-3">
          <div className="flex items-center gap-2 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {errorMessage}
          </div>
          <button
            onClick={() => setStatus('idle')}
            className="text-sm text-gray-400 underline hover:text-gray-200 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Version selector + action buttons */}
      {(status === 'idle' || status === 'error') && (
        <div className="space-y-4">
          {/* Dropdown */}
          <div className="relative">
            <select
              value={selectedTag}
              onChange={(e) => setSelectedTag(e.target.value)}
              className="w-full appearance-none rounded-lg border border-surface-600 bg-surface-700 px-4 py-2 pr-10 text-sm text-gray-100 focus:border-accent-blue focus:outline-none focus:ring-1 focus:ring-accent-blue transition-colors"
            >
              {tags.map((tag) => {
                const dateLabel = tag.date
                  ? new Date(tag.date).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : '';
                return (
                  <option key={tag.name} value={tag.name}>
                    {tag.name}
                    {tag.name === currentTag ? '  (current)' : ''}
                    {dateLabel ? `  —  ${dateLabel}` : ''}
                  </option>
                );
              })}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              disabled={!canSwitch}
              onClick={() => void handleSwitchVersion()}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                canSwitch
                  ? 'bg-accent-blue text-white hover:bg-accent-blue/80'
                  : 'bg-surface-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              <Tag className="h-4 w-4" />
              {canSwitch
                ? `Switch to ${selectedTag}`
                : 'Switch Version'}
            </button>

            <button
              disabled={status !== 'idle'}
              onClick={() => void handleUpdateLatest()}
              className="inline-flex items-center gap-2 rounded-lg border border-surface-600 bg-transparent px-4 py-2 text-sm font-medium text-gray-100 hover:bg-surface-700 transition-colors disabled:text-gray-500 disabled:cursor-not-allowed"
            >
              <GitBranch className="h-4 w-4" />
              Update to Latest
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
