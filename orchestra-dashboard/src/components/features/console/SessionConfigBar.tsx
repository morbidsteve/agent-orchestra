import { useState, useEffect, useRef, useCallback } from 'react';
import { GitBranch, FolderOpen, ChevronDown, Search } from 'lucide-react';
import { cn } from '../../../lib/cn.ts';
import { MODELS } from '../../../lib/constants.ts';
import { browseFilesystem } from '../../../lib/api.ts';
import type { BrowseResponse } from '../../../lib/types.ts';

interface SessionConfigBarProps {
  model: string;
  githubUrl: string;
  folderPath: string;
  hasConversation: boolean;
  onModelChange: (model: string) => void;
  onGithubUrlChange: (url: string) => void;
  onFolderPathChange: (path: string) => void;
}

type SourceTab = 'github' | 'local';

// ─── Setup Mode (no conversation yet) ────────────────────────────────────────

function SetupMode({
  model,
  githubUrl,
  folderPath,
  onModelChange,
  onGithubUrlChange,
  onFolderPathChange,
}: Omit<SessionConfigBarProps, 'hasConversation'>) {
  const [sourceTab, setSourceTab] = useState<SourceTab>(githubUrl ? 'github' : 'local');
  const [browseData, setBrowseData] = useState<BrowseResponse | null>(null);
  const [showBrowser, setShowBrowser] = useState(false);
  const [browseLoading, setBrowseLoading] = useState(false);
  const browserRef = useRef<HTMLDivElement>(null);

  // Close browser dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (browserRef.current && !browserRef.current.contains(e.target as Node)) {
        setShowBrowser(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleBrowse = useCallback(async (path?: string) => {
    setBrowseLoading(true);
    try {
      const data = await browseFilesystem(path);
      setBrowseData(data);
      setShowBrowser(true);
      onFolderPathChange(data.current);
    } catch {
      // Silently fail — filesystem browsing is optional
    } finally {
      setBrowseLoading(false);
    }
  }, [onFolderPathChange]);

  const handleDirectoryClick = useCallback((dir: string) => {
    handleBrowse(dir);
  }, [handleBrowse]);

  return (
    <div className="flex flex-col items-center justify-center h-full px-6">
      <div className="w-full max-w-lg space-y-6">
        {/* Model selector */}
        <div>
          <label className="block text-xs text-gray-500 mb-2">Model</label>
          <div className="flex gap-2">
            {MODELS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onModelChange(m.id)}
                title={m.description}
                className={cn(
                  'px-4 py-1.5 rounded-full text-sm font-medium transition-colors',
                  model === m.id
                    ? 'bg-accent-blue text-white'
                    : 'bg-surface-700 text-gray-400 hover:bg-surface-600 hover:text-gray-300',
                )}
              >
                {m.name.replace('Claude ', '')}
              </button>
            ))}
          </div>
        </div>

        {/* Project source tabs */}
        <div>
          <label className="block text-xs text-gray-500 mb-2">Project Source</label>
          <div className="flex border-b border-surface-600 mb-3">
            <button
              type="button"
              onClick={() => setSourceTab('github')}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
                sourceTab === 'github'
                  ? 'border-accent-blue text-accent-blue'
                  : 'border-transparent text-gray-500 hover:text-gray-300',
              )}
            >
              GitHub URL
            </button>
            <button
              type="button"
              onClick={() => setSourceTab('local')}
              className={cn(
                'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
                sourceTab === 'local'
                  ? 'border-accent-blue text-accent-blue'
                  : 'border-transparent text-gray-500 hover:text-gray-300',
              )}
            >
              Local Directory
            </button>
          </div>

          {sourceTab === 'github' ? (
            <div className="flex items-center gap-2">
              <GitBranch className="h-4 w-4 text-gray-500 shrink-0" />
              <input
                type="url"
                value={githubUrl}
                onChange={(e) => onGithubUrlChange(e.target.value)}
                placeholder="https://github.com/owner/repo"
                className="flex-1 bg-surface-900 border border-surface-600 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-accent-blue"
              />
            </div>
          ) : (
            <div className="relative" ref={browserRef}>
              <div className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4 text-gray-500 shrink-0" />
                <input
                  type="text"
                  value={folderPath}
                  onChange={(e) => onFolderPathChange(e.target.value)}
                  placeholder="/path/to/project"
                  className="flex-1 bg-surface-900 border border-surface-600 rounded-lg px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:outline-none focus:border-accent-blue"
                />
                <button
                  type="button"
                  onClick={() => handleBrowse(folderPath || undefined)}
                  disabled={browseLoading}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    'bg-surface-700 text-gray-300 hover:bg-surface-600',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                  )}
                >
                  <Search className="h-3.5 w-3.5" />
                  Browse
                </button>
              </div>

              {/* Directory browser dropdown */}
              {showBrowser && browseData && (
                <div className="absolute z-10 mt-1 w-full bg-surface-800 border border-surface-600 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                  <div className="px-3 py-1.5 text-xs text-gray-500 border-b border-surface-600 truncate">
                    {browseData.current}
                  </div>

                  {browseData.parent && (
                    <button
                      type="button"
                      onClick={() => handleDirectoryClick(browseData.parent!)}
                      className="w-full text-left px-3 py-1.5 text-sm text-gray-400 hover:bg-surface-700 flex items-center gap-2"
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                      ..
                    </button>
                  )}

                  {browseData.directories.map((dir) => {
                    const fullPath = browseData.current === '/'
                      ? `/${dir}`
                      : `${browseData.current}/${dir}`;
                    return (
                      <button
                        key={dir}
                        type="button"
                        onClick={() => handleDirectoryClick(fullPath)}
                        className="w-full text-left px-3 py-1.5 text-sm text-gray-300 hover:bg-surface-700 flex items-center gap-2"
                      >
                        <FolderOpen className="h-3.5 w-3.5 text-gray-500" />
                        {dir}
                      </button>
                    );
                  })}

                  {browseData.directories.length === 0 && (
                    <div className="px-3 py-2 text-xs text-gray-500 text-center">
                      No subdirectories
                    </div>
                  )}

                  {browseData.truncated && (
                    <div className="px-3 py-1.5 text-xs text-gray-500 text-center border-t border-surface-600">
                      Results truncated
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Hint */}
        <p className="text-xs text-gray-600 text-center">
          Configuration is optional — defaults work for most tasks
        </p>
      </div>
    </div>
  );
}

// ─── Compact Mode (conversation active) ──────────────────────────────────────

function CompactMode({
  model,
  githubUrl,
  folderPath,
  onModelChange,
}: Pick<SessionConfigBarProps, 'model' | 'githubUrl' | 'folderPath' | 'onModelChange'>) {
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowModelDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const modelInfo = MODELS.find((m) => m.id === model);
  const modelLabel = modelInfo ? modelInfo.name.replace('Claude ', '') : model;

  // Derive a display label for the project source
  let sourceLabel = 'No project';
  if (githubUrl) {
    try {
      const parts = new URL(githubUrl).pathname.split('/').filter(Boolean);
      sourceLabel = parts.length >= 2 ? `${parts[0]}/${parts[1]}` : githubUrl;
    } catch {
      sourceLabel = githubUrl;
    }
  } else if (folderPath) {
    const parts = folderPath.split('/').filter(Boolean);
    sourceLabel = parts[parts.length - 1] ?? folderPath;
  }

  return (
    <div className="bg-surface-800 border-b border-surface-600 px-4 py-2 flex items-center gap-3">
      {/* Model badge with dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setShowModelDropdown(!showModelDropdown)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-surface-700 text-gray-300 hover:bg-surface-600 transition-colors"
        >
          {modelLabel}
          <ChevronDown className="h-3 w-3 text-gray-500" />
        </button>

        {showModelDropdown && (
          <div className="absolute top-full left-0 mt-1 z-10 bg-surface-800 border border-surface-600 rounded-lg shadow-lg min-w-[180px]">
            {MODELS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onModelChange(m.id);
                  setShowModelDropdown(false);
                }}
                className={cn(
                  'w-full text-left px-3 py-2 text-sm transition-colors',
                  model === m.id
                    ? 'bg-accent-blue/10 text-accent-blue'
                    : 'text-gray-300 hover:bg-surface-700',
                )}
              >
                <div className="font-medium">{m.name.replace('Claude ', '')}</div>
                <div className="text-xs text-gray-500">{m.description}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Project source badge (read-only) */}
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs bg-surface-700 text-gray-400">
        {githubUrl ? (
          <GitBranch className="h-3 w-3" />
        ) : folderPath ? (
          <FolderOpen className="h-3 w-3" />
        ) : null}
        {sourceLabel}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function SessionConfigBar(props: SessionConfigBarProps) {
  if (props.hasConversation) {
    return (
      <CompactMode
        model={props.model}
        githubUrl={props.githubUrl}
        folderPath={props.folderPath}
        onModelChange={props.onModelChange}
      />
    );
  }

  return (
    <SetupMode
      model={props.model}
      githubUrl={props.githubUrl}
      folderPath={props.folderPath}
      onModelChange={props.onModelChange}
      onGithubUrlChange={props.onGithubUrlChange}
      onFolderPathChange={props.onFolderPathChange}
    />
  );
}
