import { useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, File, Folder, FolderOpen } from 'lucide-react';
import { cn } from '../../../lib/cn.ts';
import type { FileTreeNode } from '../../../lib/types.ts';

interface FileTreePanelProps {
  tree: FileTreeNode[];
  activeFiles: string[];
}

const ACTION_BADGE_STYLES: Record<string, string> = {
  read: 'bg-gray-500/20 text-gray-400',
  write: 'bg-yellow-500/20 text-yellow-400',
  edit: 'bg-yellow-500/20 text-yellow-400',
  create: 'bg-green-500/20 text-green-400',
  delete: 'bg-red-500/20 text-red-400',
};

function hasActiveDescendant(node: FileTreeNode, activeFiles: string[]): boolean {
  if (node.type === 'file') return activeFiles.includes(node.path);
  if (!node.children) return false;
  return node.children.some(child => hasActiveDescendant(child, activeFiles));
}

function TreeNode({ node, activeFiles, depth }: { node: FileTreeNode; activeFiles: string[]; depth: number }) {
  const isDir = node.type === 'directory';
  const shouldDefaultOpen = isDir && hasActiveDescendant(node, activeFiles);
  const [expanded, setExpanded] = useState(shouldDefaultOpen);

  const toggle = useCallback(() => {
    if (isDir) setExpanded(prev => !prev);
  }, [isDir]);

  const paddingLeft = depth * 16 + 4;

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        className={cn(
          'flex items-center gap-1.5 w-full text-left py-1 px-1 rounded text-xs hover:bg-surface-700 transition-colors',
          node.isActive && 'bg-blue-500/10',
        )}
        style={{ paddingLeft: `${paddingLeft}px` }}
      >
        {isDir ? (
          <>
            {expanded ? (
              <ChevronDown className="h-3 w-3 text-gray-500 shrink-0" />
            ) : (
              <ChevronRight className="h-3 w-3 text-gray-500 shrink-0" />
            )}
            {expanded ? (
              <FolderOpen className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
            ) : (
              <Folder className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
            )}
          </>
        ) : (
          <>
            <span className="w-3 shrink-0" />
            <File className={cn(
              'h-3.5 w-3.5 shrink-0',
              node.isActive ? 'text-blue-400' : 'text-gray-500',
            )} />
          </>
        )}

        <span className={cn(
          'truncate',
          node.isActive ? 'text-blue-300 font-medium' : 'text-gray-300',
        )}>
          {node.name}
        </span>

        {node.isActive && (
          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse shrink-0" />
        )}

        {node.lastActivity && (
          <span className={cn(
            'ml-auto text-[10px] px-1.5 py-0.5 rounded-full shrink-0',
            ACTION_BADGE_STYLES[node.lastActivity.action] || 'bg-gray-500/20 text-gray-400',
          )}>
            {node.lastActivity.agentName} · {node.lastActivity.action}
          </span>
        )}
      </button>

      {isDir && expanded && node.children && (
        <div>
          {node.children.map(child => (
            <TreeNode key={child.path} node={child} activeFiles={activeFiles} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export function FileTreePanel({ tree, activeFiles }: FileTreePanelProps) {
  if (tree.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-4 py-8">
        <Folder className="h-6 w-6 text-gray-600 mb-2" />
        <p className="text-xs text-gray-500">No file activity yet</p>
        <p className="text-xs text-gray-600 mt-1">File reads, writes, and edits will appear here.</p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto p-2">
      {tree.map(node => (
        <TreeNode key={node.path} node={node} activeFiles={activeFiles} depth={0} />
      ))}
    </div>
  );
}
