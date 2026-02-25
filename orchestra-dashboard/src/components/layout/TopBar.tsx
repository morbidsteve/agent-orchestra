import { Plus, Users, AlertTriangle, Settings, X, MessageSquare } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { cn } from '../../lib/cn.ts';
import { useSessionContext } from '../../context/SessionContext.tsx';
import { version } from '../../../package.json';

export function TopBar() {
  const { sessions, activeSessionId, createSession, closeSession, switchSession } = useSessionContext();
  const navigate = useNavigate();
  const location = useLocation();

  const isGlobalPage = location.pathname !== '/';

  function handleNewSession() {
    const id = createSession();
    switchSession(id);
    if (location.pathname !== '/') navigate('/');
  }

  function handleTabClick(id: string) {
    switchSession(id);
    if (location.pathname !== '/') navigate('/');
  }

  function handleClose(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    closeSession(id);
  }

  return (
    <header className="fixed top-0 left-0 right-0 h-12 bg-surface-800 border-b border-surface-600 flex items-center px-4 z-20">
      {/* Logo */}
      <div className="flex items-center gap-2 mr-4 shrink-0">
        <MessageSquare className="h-5 w-5 text-accent-blue" />
        <span className="text-sm font-semibold text-gray-100 hidden sm:inline">Orchestra</span>
        <span className="text-[10px] text-gray-600 hidden sm:inline">v{version}</span>
      </div>

      {/* Session Tabs */}
      <div className="flex items-center gap-1 flex-1 min-w-0 overflow-x-auto scrollbar-none">
        {sessions.map(session => (
          <button
            key={session.id}
            type="button"
            onClick={() => handleTabClick(session.id)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors max-w-[200px] min-w-[80px] group shrink-0',
              session.id === activeSessionId && !isGlobalPage
                ? 'bg-surface-600 text-gray-100'
                : 'text-gray-400 hover:text-gray-200 hover:bg-surface-700',
            )}
          >
            <span className="truncate flex-1 text-left">{session.label}</span>
            {sessions.length > 1 && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => handleClose(e as unknown as React.MouseEvent, session.id)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleClose(e as unknown as React.MouseEvent, session.id); }}
                className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity shrink-0"
              >
                <X className="h-3 w-3" />
              </span>
            )}
          </button>
        ))}

        {/* New session button */}
        <button
          type="button"
          onClick={handleNewSession}
          className="flex items-center justify-center h-7 w-7 rounded-md text-gray-500 hover:text-gray-300 hover:bg-surface-700 transition-colors shrink-0"
          aria-label="New session"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {/* Global nav icons */}
      <div className="flex items-center gap-1 ml-4 shrink-0">
        <button
          type="button"
          onClick={() => navigate('/agents')}
          className={cn(
            'flex items-center justify-center h-8 w-8 rounded-md transition-colors',
            location.pathname === '/agents' ? 'bg-accent-blue/10 text-accent-blue' : 'text-gray-500 hover:text-gray-300 hover:bg-surface-700',
          )}
          aria-label="Agents"
        >
          <Users className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => navigate('/findings')}
          className={cn(
            'flex items-center justify-center h-8 w-8 rounded-md transition-colors',
            location.pathname === '/findings' ? 'bg-accent-blue/10 text-accent-blue' : 'text-gray-500 hover:text-gray-300 hover:bg-surface-700',
          )}
          aria-label="Findings"
        >
          <AlertTriangle className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className={cn(
            'flex items-center justify-center h-8 w-8 rounded-md transition-colors',
            location.pathname === '/settings' ? 'bg-accent-blue/10 text-accent-blue' : 'text-gray-500 hover:text-gray-300 hover:bg-surface-700',
          )}
          aria-label="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
