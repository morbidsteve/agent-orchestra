import { useState } from 'react';
import { GitBranch, Plus, FolderGit2 } from 'lucide-react';
import { cn } from '../../../lib/cn.ts';
import type { Codebase } from '../../../lib/types.ts';

interface CodebaseSelectorProps {
  codebases: Codebase[];
  selectedId: string | null;
  githubUrl: string;
  onSelectCodebase: (id: string | null) => void;
  onGithubUrlChange: (url: string) => void;
  onCreateCodebase: (name: string, gitUrl?: string) => void;
  isLoading?: boolean;
}

export function CodebaseSelector({
  codebases,
  selectedId,
  githubUrl,
  onSelectCodebase,
  onGithubUrlChange,
  onCreateCodebase,
  isLoading,
}: CodebaseSelectorProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGitUrl, setNewGitUrl] = useState('');

  const selectedCodebase = codebases.find(c => c.id === selectedId);

  function handleCreate() {
    const trimmedName = newName.trim();
    if (!trimmedName) return;
    onCreateCodebase(trimmedName, newGitUrl.trim() || undefined);
    setNewName('');
    setNewGitUrl('');
    setShowCreateForm(false);
  }

  return (
    <div className="space-y-2">
      {/* Codebase dropdown */}
      <div className="flex items-center gap-2">
        <FolderGit2 className="h-3.5 w-3.5 text-gray-500 shrink-0" />
        <select
          value={selectedId ?? ''}
          onChange={(e) => {
            const value = e.target.value;
            if (value === '__new__') {
              setShowCreateForm(true);
              onSelectCodebase(null);
            } else if (value === '') {
              onSelectCodebase(null);
            } else {
              onSelectCodebase(value);
              setShowCreateForm(false);
            }
          }}
          className="flex-1 bg-surface-900 border border-surface-600 rounded-md px-2 py-1 text-xs text-gray-300 focus:outline-none focus:border-accent-blue"
          disabled={isLoading}
        >
          <option value="">No project selected</option>
          {codebases.map(cb => (
            <option key={cb.id} value={cb.id}>{cb.name}</option>
          ))}
          <option value="__new__">+ New project</option>
        </select>
      </div>

      {/* Selected codebase info */}
      {selectedCodebase && (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-surface-700/50 text-xs">
          <GitBranch className="h-3 w-3 text-gray-500 shrink-0" />
          <span className="text-gray-400 truncate">{selectedCodebase.path}</span>
          {selectedCodebase.gitUrl && (
            <span className="text-gray-500 truncate ml-auto">{selectedCodebase.gitUrl}</span>
          )}
        </div>
      )}

      {/* GitHub URL input (shown when no codebase selected) */}
      {!selectedId && !showCreateForm && (
        <div className="flex items-center gap-2">
          <GitBranch className="h-3.5 w-3.5 text-gray-500 shrink-0" />
          <input
            type="url"
            value={githubUrl}
            onChange={(e) => onGithubUrlChange(e.target.value)}
            placeholder="https://github.com/owner/repo"
            className="flex-1 bg-surface-900 border border-surface-600 rounded-md px-2 py-1 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-accent-blue"
          />
        </div>
      )}

      {/* Create form */}
      {showCreateForm && (
        <div className="space-y-1.5 p-2 rounded border border-surface-600 bg-surface-700/30">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Project name"
            className="w-full bg-surface-900 border border-surface-600 rounded-md px-2 py-1 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-accent-blue"
          />
          <input
            type="url"
            value={newGitUrl}
            onChange={(e) => setNewGitUrl(e.target.value)}
            placeholder="Git URL (optional)"
            className="w-full bg-surface-900 border border-surface-600 rounded-md px-2 py-1 text-xs text-gray-300 placeholder-gray-600 focus:outline-none focus:border-accent-blue"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={!newName.trim() || isLoading}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors',
                'bg-accent-blue text-white hover:bg-accent-blue/80',
                'disabled:opacity-40 disabled:cursor-not-allowed',
              )}
            >
              <Plus className="h-3 w-3" />
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowCreateForm(false)}
              className="px-2 py-1 rounded text-xs text-gray-400 hover:text-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
