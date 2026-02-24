import { NavLink } from 'react-router-dom';
import {
  MessageSquare,
  LayoutDashboard,
  Building2,
  Users,
  AlertTriangle,
  Settings,
  Activity,
} from 'lucide-react';
import { StatusDot } from '../ui/StatusDot.tsx';
import { useOrchestra } from '../../context/OrchestraContext.tsx';
import { useConversationContext } from '../../context/ConversationContext.tsx';
import { useConsoleWebSocket } from '../../hooks/useConsoleWebSocket.ts';
import { useDynamicAgents } from '../../hooks/useDynamicAgents.ts';
import { cn } from '../../lib/cn.ts';
import { version } from '../../../package.json';

const navItems = [
  { to: '/', label: 'Console', icon: MessageSquare },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/office', label: 'Agent Office', icon: Building2 },
  { to: '/agents', label: 'Agents', icon: Users },
  { to: '/findings', label: 'Findings', icon: AlertTriangle },
  { to: '/settings', label: 'Settings', icon: Settings },
];

const DYNAMIC_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-gray-400',
  running: 'bg-blue-400',
  completed: 'bg-green-400',
  failed: 'bg-red-400',
};

export function Sidebar() {
  const { agents, isLive, authStatus } = useOrchestra();
  const { conversation } = useConversationContext();
  const conversationId = conversation?.id ?? null;
  const { messages: wsMessages } = useConsoleWebSocket(conversationId);
  const { agents: dynamicAgents } = useDynamicAgents(wsMessages);

  const runningDynamic = dynamicAgents.filter(a => a.status === 'running');
  const hasDynamicAgents = dynamicAgents.length > 0;

  return (
    <aside className="fixed left-0 top-0 bottom-0 w-60 bg-surface-800 border-r border-surface-600 flex flex-col z-10">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-surface-600">
        <div className="flex items-center gap-2.5">
          <MessageSquare className="h-6 w-6 text-accent-blue" />
          <div>
            <h1 className="text-base font-semibold text-gray-100">Agent Orchestra</h1>
            <p className="text-xs text-gray-500">Multi-Agent System</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
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

        {/* Active Executions section */}
        {hasDynamicAgents && (
          <div className="mt-4 pt-4 border-t border-surface-600">
            <div className="flex items-center justify-between px-3 mb-2">
              <div className="flex items-center gap-1.5">
                <Activity className="h-3 w-3 text-gray-500" />
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Active</span>
              </div>
              {runningDynamic.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/15 text-blue-400 font-medium">
                  {runningDynamic.length}
                </span>
              )}
            </div>
            <div className="space-y-1.5 px-3">
              {dynamicAgents.slice(0, 8).map(agent => (
                <div key={agent.id} className="flex items-center gap-2">
                  <span className={cn(
                    'h-1.5 w-1.5 rounded-full shrink-0',
                    DYNAMIC_STATUS_COLORS[agent.status] || 'bg-gray-500',
                    agent.status === 'running' && 'animate-pulse',
                  )} />
                  <span className="text-xs text-gray-400 truncate">{agent.name}</span>
                </div>
              ))}
              {dynamicAgents.length > 8 && (
                <span className="text-[10px] text-gray-500 pl-3.5">
                  +{dynamicAgents.length - 8} more
                </span>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* Agent Status — show dynamic agents when active, registry agents as fallback */}
      <div className="px-4 py-4 border-t border-surface-600">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Agents</p>
        <div className="space-y-2.5">
          {hasDynamicAgents ? (
            dynamicAgents.map((agent) => (
              <div key={agent.id} className="flex items-center gap-2.5">
                <span className={cn(
                  'h-2 w-2 rounded-full shrink-0',
                  DYNAMIC_STATUS_COLORS[agent.status] || 'bg-gray-500',
                  agent.status === 'running' && 'animate-pulse',
                )} />
                <span className="text-xs text-gray-400 truncate">{agent.name}</span>
              </div>
            ))
          ) : agents.some(a => a.status === 'busy') ? (
            agents.filter(a => a.status === 'busy').map((agent) => (
              <div key={agent.role} className="flex items-center gap-2.5">
                <StatusDot status={agent.status} size="sm" />
                <span className="text-xs text-gray-400 truncate">{agent.name}</span>
              </div>
            ))
          ) : (
            <span className="text-xs text-gray-500">No active agents</span>
          )}
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
