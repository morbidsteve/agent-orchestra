import { Plus, Circle } from 'lucide-react';
import { cn } from '../../../lib/cn.ts';

interface ExecutionTab {
  id: string;
  title: string;
  status: 'running' | 'completed' | 'failed' | null;
}

interface ExecutionTabsProps {
  tabs: ExecutionTab[];
  activeTabId: string | null;
  onTabSelect: (id: string) => void;
  onNewTab: () => void;
}

const STATUS_DOT_COLORS: Record<string, string> = {
  running: 'text-blue-400',
  completed: 'text-green-400',
  failed: 'text-red-400',
};

function truncateTitle(title: string, maxLen = 20): string {
  if (title.length <= maxLen) return title;
  return `${title.slice(0, maxLen)}...`;
}

export function ExecutionTabs({ tabs, activeTabId, onTabSelect, onNewTab }: ExecutionTabsProps) {
  return (
    <div className="flex items-center gap-1 px-2 py-1.5 border-b border-surface-600 bg-surface-800 overflow-x-auto">
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabSelect(tab.id)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
            tab.id === activeTabId
              ? 'bg-surface-700 text-gray-200 border border-surface-500'
              : 'text-gray-400 hover:text-gray-300 hover:bg-surface-700/50',
          )}
        >
          {tab.status && (
            <Circle className={cn(
              'h-2 w-2 fill-current',
              STATUS_DOT_COLORS[tab.status] || 'text-gray-500',
              tab.status === 'running' && 'animate-pulse',
            )} />
          )}
          <span>{truncateTitle(tab.title)}</span>
        </button>
      ))}

      <button
        type="button"
        onClick={onNewTab}
        className="flex items-center justify-center h-7 w-7 rounded-md text-gray-500 hover:text-gray-300 hover:bg-surface-700 transition-colors shrink-0"
        title="New execution"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export type { ExecutionTab };
