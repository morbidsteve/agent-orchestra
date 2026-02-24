import { NavLink } from 'react-router-dom';
import {
  Activity,
  LayoutDashboard,
  Plus,
  Users,
  AlertTriangle,
  Settings,
} from 'lucide-react';
import { StatusDot } from '../ui/StatusDot.tsx';
import { useOrchestra } from '../../context/OrchestraContext.tsx';
import { cn } from '../../lib/cn.ts';
import { version } from '../../../package.json';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/new', label: 'New Execution', icon: Plus },
  { to: '/agents', label: 'Agents', icon: Users },
  { to: '/findings', label: 'Findings', icon: AlertTriangle },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const { agents, isLive, authStatus } = useOrchestra();

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-60 bg-surface-800 border-r border-surface-600 flex flex-col z-10">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-surface-600">
        <div className="flex items-center gap-2.5">
          <Activity className="h-6 w-6 text-accent-blue" />
          <div>
            <h1 className="text-base font-semibold text-gray-100">Agent Orchestra</h1>
            <p className="text-xs text-gray-500">Multi-Agent System</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-accent-blue/10 text-accent-blue'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-surface-700',
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Agent Status */}
      <div className="px-4 py-4 border-t border-surface-600">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Agents</p>
        <div className="space-y-2.5">
          {agents.map((agent) => (
            <div key={agent.role} className="flex items-center gap-2.5">
              <StatusDot status={agent.status} size="sm" />
              <span className="text-xs text-gray-400 truncate">{agent.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Integrations */}
      <div className="px-4 py-4 border-t border-surface-600">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Integrations</p>
        <div className="space-y-2.5">
          <div className="flex items-center gap-2.5">
            <div className={cn(
              'h-2 w-2 rounded-full',
              authStatus?.github?.authenticated ? 'bg-green-400' : 'bg-gray-500'
            )} />
            <span className="text-xs text-gray-400 truncate">
              GitHub{authStatus?.github?.username ? ` · ${authStatus.github.username}` : ''}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <div className={cn(
              'h-2 w-2 rounded-full',
              authStatus?.claude?.authenticated ? 'bg-green-400' : 'bg-gray-500'
            )} />
            <span className="text-xs text-gray-400 truncate">Claude Code</span>
          </div>
        </div>
      </div>

      {/* Connection Status */}
      <div className="px-4 py-3 border-t border-surface-600">
        <div className="flex items-center gap-2">
          <div className={cn(
            'h-2 w-2 rounded-full',
            isLive ? 'bg-green-400' : 'bg-gray-500'
          )} />
          <span className="text-xs text-gray-500">
            {isLive ? 'Live' : 'Mock Data'} · v{version}
          </span>
        </div>
      </div>
    </aside>
  );
}
