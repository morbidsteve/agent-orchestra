import { Terminal, Code, FlaskConical, Shield, Briefcase, CheckCircle, XCircle } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../../lib/cn.ts';
import { ConnectionLine } from './ConnectionLine.tsx';
import type { OfficeState, AgentNode, AgentConnection } from '../../../lib/types.ts';

interface MiniOfficeProps {
  officeState: OfficeState;
}

// Layout positions as percentages (same as OfficeCanvas)
const AGENT_POSITIONS: Record<string, { x: number; y: number }> = {
  'orchestrator': { x: 50, y: 50 },
  'developer': { x: 25, y: 20 },
  'developer-2': { x: 75, y: 20 },
  'tester': { x: 20, y: 75 },
  'devsecops': { x: 50, y: 80 },
  'business-dev': { x: 80, y: 75 },
};

const AGENT_COLORS: Record<string, string> = {
  'orchestrator': '#3b82f6',
  'developer': '#3b82f6',
  'developer-2': '#06b6d4',
  'tester': '#22c55e',
  'devsecops': '#f97316',
  'business-dev': '#a855f7',
};

/** Default idle connections for mini view */
const MINI_IDLE_CONNECTIONS: AgentConnection[] = [
  { from: 'orchestrator', to: 'developer', label: '', active: false, dataFlow: 'handoff' },
  { from: 'orchestrator', to: 'developer-2', label: '', active: false, dataFlow: 'handoff' },
  { from: 'orchestrator', to: 'tester', label: '', active: false, dataFlow: 'handoff' },
  { from: 'orchestrator', to: 'devsecops', label: '', active: false, dataFlow: 'handoff' },
  { from: 'orchestrator', to: 'business-dev', label: '', active: false, dataFlow: 'handoff' },
];

const MINI_ICONS: Record<string, LucideIcon> = {
  developer: Terminal,
  'developer-2': Code,
  tester: FlaskConical,
  devsecops: Shield,
  'business-dev': Briefcase,
};

// Short names for mini view
const SHORT_NAMES: Record<string, string> = {
  'developer': 'Dev',
  'developer-2': 'Dev 2',
  'tester': 'Test',
  'devsecops': 'Sec',
  'business-dev': 'Biz',
};

function MiniAgentNode({ agent }: { agent: AgentNode }) {
  const Icon = MINI_ICONS[agent.role] || Terminal;
  const isWorking = agent.visualStatus === 'working';
  const isDone = agent.visualStatus === 'done';
  const isError = agent.visualStatus === 'error';

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-300',
            isWorking && 'animate-pulse',
          )}
          style={{
            borderColor: agent.color,
            backgroundColor: `${agent.color}15`,
            boxShadow: isWorking ? `0 0 10px ${agent.color}44` : undefined,
          }}
        >
          <Icon className="h-4 w-4" style={{ color: agent.color }} />
        </div>
        {isDone && (
          <div className="absolute -top-0.5 -right-0.5 rounded-full bg-surface-900 p-px">
            <CheckCircle className="h-3 w-3 text-green-400" />
          </div>
        )}
        {isError && (
          <div className="absolute -top-0.5 -right-0.5 rounded-full bg-surface-900 p-px">
            <XCircle className="h-3 w-3 text-red-400" />
          </div>
        )}
      </div>
      <span className="text-[8px] text-gray-400">{SHORT_NAMES[agent.role] || agent.name}</span>
    </div>
  );
}

export function MiniOffice({ officeState }: MiniOfficeProps) {
  const { agents, connections, currentPhase, executionId } = officeState;
  const isActive = executionId !== null && currentPhase !== null;

  // Show default idle connections when no WebSocket connections exist
  const displayConnections = connections.length > 0 ? connections : MINI_IDLE_CONNECTIONS;

  return (
    <div className="relative h-48 w-full overflow-hidden rounded-lg border border-surface-600 bg-surface-900">
      {/* SVG connection layer */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ pointerEvents: 'none' }}
      >
        {displayConnections.map((conn) => {
          const fromPos = AGENT_POSITIONS[conn.from] || AGENT_POSITIONS['orchestrator'];
          const toPos = AGENT_POSITIONS[conn.to] || AGENT_POSITIONS['orchestrator'];
          const color = AGENT_COLORS[conn.from] || '#6b7280';

          return (
            <ConnectionLine
              key={`${conn.from}-${conn.to}`}
              x1={fromPos.x}
              y1={fromPos.y}
              x2={toPos.x}
              y2={toPos.y}
              color={color}
              active={conn.active}
            />
          );
        })}
      </svg>

      {/* Mini agent nodes */}
      {agents.map((agent) => {
        const pos = AGENT_POSITIONS[agent.role];
        if (!pos) return null;

        return (
          <div
            key={agent.role}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
            }}
          >
            <MiniAgentNode agent={agent} />
          </div>
        );
      })}

      {/* Mini orchestrator hub */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{
          left: `${AGENT_POSITIONS['orchestrator'].x}%`,
          top: `${AGENT_POSITIONS['orchestrator'].y}%`,
        }}
      >
        <div className="flex flex-col items-center gap-0.5">
          <div
            className={cn(
              'flex h-12 w-12 items-center justify-center rounded-full border transition-all duration-300',
              'border-blue-500/50',
            )}
            style={{
              background: 'linear-gradient(135deg, rgba(59,130,246,0.1), rgba(168,85,247,0.1))',
              boxShadow: isActive
                ? '0 0 12px rgba(59,130,246,0.2)'
                : '0 0 8px rgba(59,130,246,0.1)',
            }}
          >
            {isActive && (
              <div
                className="absolute h-12 w-12 rounded-full border border-transparent"
                style={{
                  borderTopColor: '#3b82f6',
                  animation: 'spin 2s linear infinite',
                }}
              />
            )}
            <div
              className={cn(
                'h-2 w-2 rounded-full',
                isActive ? 'bg-blue-400 animate-pulse' : 'bg-blue-400/50',
              )}
            />
          </div>
          <span className="text-[8px] text-gray-400">Orch</span>
          {currentPhase && (
            <span className="rounded-full bg-blue-500/10 px-1 py-px text-[7px] text-blue-400 capitalize">
              {currentPhase}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
