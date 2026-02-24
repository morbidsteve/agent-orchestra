import { WorkstationCard } from './WorkstationCard.tsx';
import { OrchestratorDesk } from './OrchestratorDesk.tsx';
import { ConnectionLine } from './ConnectionLine.tsx';
import { getStablePosition } from '../../../lib/layoutEngine.ts';
import type { OfficeState, AgentConnection } from '../../../lib/types.ts';

interface OfficeCanvasProps {
  officeState: OfficeState;
  agentOutputMap?: Map<string, string[]>;
  agentFilesMap?: Map<string, string[]>;
}

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

const CENTER = { x: 50, y: 50 };

export function OfficeCanvas({ officeState, agentOutputMap, agentFilesMap }: OfficeCanvasProps) {
  const { agents, connections, currentPhase, executionId } = officeState;
  const isActive = executionId !== null && currentPhase !== null;

  // Build position map for agents using layout engine
  const agentPositions = new Map<string, { x: number; y: number }>();
  agents.forEach((agent, index) => {
    const pos = getStablePosition(index);
    agentPositions.set(agent.role, { x: pos.x, y: pos.y });
  });

  // Derive orchestrator -> working-agent connections from agent status
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
    : agents.length > 0
      ? DEFAULT_IDLE_CONNECTIONS.filter(c => agentPositions.has(c.to))
      : DEFAULT_IDLE_CONNECTIONS;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-surface-600 bg-surface-900">
      {/* Subtle grid background */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage: 'radial-gradient(circle, #6b7280 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* SVG connection layer - viewBox maps to percentage coords */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ pointerEvents: 'none', zIndex: 1 }}
      >
        {displayConnections.map((conn) => {
          const fromPos = conn.from === 'orchestrator' ? CENTER : (agentPositions.get(conn.from) || CENTER);
          const toPos = conn.to === 'orchestrator' ? CENTER : (agentPositions.get(conn.to) || CENTER);
          const color = AGENT_COLORS[conn.from] || agents.find(a => a.role === conn.from)?.color || '#6b7280';

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

      {/* Agent workstation cards - positioned absolutely using layout engine coordinates */}
      <div className="absolute inset-0" style={{ zIndex: 2 }}>
        {agents.map((agent) => {
          const pos = agentPositions.get(agent.role);
          if (!pos) return null;

          const outputLines = agentOutputMap?.get(agent.role) ?? [];
          const filesWorking = agentFilesMap?.get(agent.role) ?? [];

          return (
            <div
              key={agent.role}
              className="transition-all duration-500 ease-out"
              style={{
                animation: 'fadeScaleIn 0.3s ease-out',
              }}
            >
              <WorkstationCard
                agent={agent}
                position={pos}
                outputLines={outputLines}
                filesWorking={filesWorking}
              />
            </div>
          );
        })}
      </div>

      {/* Orchestrator desk at center */}
      <div style={{ zIndex: 3 }}>
        <OrchestratorDesk
          currentPhase={currentPhase}
          agentCount={agents.length}
          isActive={isActive}
          executionId={executionId}
        />
      </div>

      {/* CSS animations */}
      <style>{`
        @keyframes fadeScaleIn {
          from {
            opacity: 0;
            transform: scale(0.8);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
