import { MessageSquare, Building2, LayoutDashboard } from 'lucide-react';
import { cn } from '../../lib/cn.ts';
import { useSessionContext } from '../../context/SessionContext.tsx';
import type { SessionSubView } from '../../lib/types.ts';

const SUB_NAV_ITEMS: { view: SessionSubView; label: string; icon: typeof MessageSquare }[] = [
  { view: 'console', label: 'Console', icon: MessageSquare },
  { view: 'office', label: 'Office', icon: Building2 },
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
];

export function SessionSubNav() {
  const { session, setActiveView } = useSessionContext();
  const activeView = session?.activeView ?? 'console';

  return (
    <nav className="fixed top-12 left-0 right-0 h-10 bg-surface-800/80 backdrop-blur-sm border-b border-surface-600 flex items-center px-4 z-10">
      <div className="flex items-center gap-1">
        {SUB_NAV_ITEMS.map(({ view, label, icon: Icon }) => (
          <button
            key={view}
            type="button"
            onClick={() => setActiveView(view)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              activeView === view
                ? 'bg-accent-blue/10 text-accent-blue'
                : 'text-gray-400 hover:text-gray-200 hover:bg-surface-700',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}
