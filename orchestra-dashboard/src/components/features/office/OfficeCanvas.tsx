import { AgentDesk } from './AgentDesk.tsx';
import { OrchestratorHub } from './OrchestratorHub.tsx';
import { ConnectionLine } from './ConnectionLine.tsx';
import type { OfficeState, AgentConnection } from '../../../lib/types.ts';

interface OfficeCanvasProps {
  officeState: OfficeState;
}

// Layout positions as percentages
const AGENT_POSITIONS: Record<string, { x: number; y: number }> = {
  'orchestrator': { x: 50, y: 50 },
  'developer': { x: 25, y: 20 },
  'developer-2': { x: 75, y: 20 },
  'tester': { x: 20, y: 75 },
  'devsecops': { x: 50, y: 80 },
  'business-dev': { x: 80, y: 75 },
};

// Color lookup for connections
const AGENT_COLORS: Record<string, string> = {
  'orchestrator': '#3b82f6',
  'developer': '#3b82f6',
  'developer-2': '#06b6d4',
  'tester': '#22c55e',
  'devsecops': '#f97316',
  'business-dev': '#a855f7',
};

/** Default idle connections showing team structure at rest */
const DEFAULT_IDLE_CONNECTIONS: AgentConnection[] = [
  { from: 'orchestrator', to: 'developer', label: '', active: false, dataFlow: 'handoff' },
  { from: 'orchestrator', to: 'developer-2', label: '', active: false, dataFlow: 'handoff' },
  { from: 'orchestrator', to: 'tester', label: '', active: false, dataFlow: 'handoff' },
  { from: 'orchestrator', to: 'devsecops', label: '', active: false, dataFlow: 'handoff' },
  { from: 'orchestrator', to: 'business-dev', label: '', active: false, dataFlow: 'handoff' },
];

export function OfficeCanvas({ officeState }: OfficeCanvasProps) {
  const { agents, connections, currentPhase, executionId } = officeState;
  const isActive = executionId !== null && currentPhase !== null;

  // Derive orchestrator → working-agent connections from agent status
  const orchestratorConnections: AgentConnection[] = agents
    .filter(a => a.visualStatus === 'working')
    .map(a => ({
      from: 'orchestrator',
      to: a.role,
      label: '',
      active: true,
      dataFlow: 'broadcast' as const,
    }));

  // Show explicit + orchestrator connections when any exist, idle defaults otherwise
  const hasActivity = connections.length > 0 || orchestratorConnections.length > 0;
  const displayConnections = hasActivity
    ? [...orchestratorConnections, ...connections]
    : DEFAULT_IDLE_CONNECTIONS;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-surface-600 bg-surface-900">
      {/* SVG connection layer - viewBox maps to percentage coords */}
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
              label={conn.label}
            />
          );
        })}
      </svg>

      {/* Agent desk nodes - positioned absolutely via percentage */}
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
            <AgentDesk agent={agent} />
          </div>
        );
      })}

      {/* Orchestrator Hub - centered */}
      <div
        className="absolute -translate-x-1/2 -translate-y-1/2"
        style={{
          left: `${AGENT_POSITIONS['orchestrator'].x}%`,
          top: `${AGENT_POSITIONS['orchestrator'].y}%`,
        }}
      >
        <OrchestratorHub
          currentPhase={currentPhase}
          executionId={executionId}
          isActive={isActive}
        />
      </div>
    </div>
  );
}
