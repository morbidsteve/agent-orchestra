import { DeskWorkstation } from './WorkstationCard.tsx';
import { CommandCenter } from './OrchestratorDesk.tsx';
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

/** Zone labels positioned around the office floor */
const ZONE_LABELS: { text: string; x: string; y: string }[] = [
  { text: 'DEV BAY', x: '18%', y: '22%' },
  { text: 'TEST LAB', x: '78%', y: '22%' },
  { text: 'SECURITY', x: '78%', y: '78%' },
  { text: 'STRATEGY', x: '18%', y: '78%' },
];

/** Decorative potted plants */
const PLANTS: { x: string; y: string }[] = [
  { x: '5%', y: '5%' },
  { x: '93%', y: '5%' },
  { x: '5%', y: '93%' },
  { x: '93%', y: '93%' },
];

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
  // Deduplicate by from-to key, preferring active connections
  const hasActivity = connections.length > 0 || orchestratorConnections.length > 0;
  const mergedConnections = hasActivity
    ? [...orchestratorConnections, ...connections]
    : agents.length > 0
      ? DEFAULT_IDLE_CONNECTIONS.filter(c => agentPositions.has(c.to))
      : DEFAULT_IDLE_CONNECTIONS;
  const connMap = new Map<string, AgentConnection>();
  for (const c of mergedConnections) {
    const key = `${c.from}-${c.to}`;
    const existing = connMap.get(key);
    if (!existing || (c.active && !existing.active)) connMap.set(key, c);
  }
  const displayConnections = [...connMap.values()];

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-lg"
      style={{
        backgroundColor: '#1a1d23',
        border: '1px solid #2a2d35',
      }}
    >
      {/* Carpet-tile grid background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(37,40,48,0.15) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(37,40,48,0.15) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Warm ambient gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 50% 50%, rgba(120,90,50,0.04) 0%, transparent 65%)',
        }}
      />

      {/* Zone partition lines (glass walls) */}
      <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
        {/* Vertical center partition */}
        <div
          className="absolute top-[15%] bottom-[15%] left-1/2"
          style={{
            width: '1px',
            background: 'linear-gradient(to bottom, transparent, rgba(100,116,139,0.12) 30%, rgba(100,116,139,0.12) 70%, transparent)',
          }}
        />
        {/* Horizontal center partition */}
        <div
          className="absolute left-[15%] right-[15%] top-1/2"
          style={{
            height: '1px',
            background: 'linear-gradient(to right, transparent, rgba(100,116,139,0.12) 30%, rgba(100,116,139,0.12) 70%, transparent)',
          }}
        />
        {/* Command center boundary (rounded rect) */}
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-2xl"
          style={{
            width: '22%',
            height: '22%',
            border: '1px dashed rgba(100,116,139,0.1)',
          }}
        />
      </div>

      {/* Zone labels (floor stencils) */}
      {ZONE_LABELS.map(z => (
        <span
          key={z.text}
          className="absolute text-[9px] font-mono tracking-widest select-none"
          style={{
            left: z.x,
            top: z.y,
            color: 'rgba(100,116,139,0.18)',
            transform: 'translate(-50%, -50%)',
          }}
        >
          {z.text}
        </span>
      ))}

      {/* Decorative plants */}
      {PLANTS.map((p, i) => (
        <div
          key={i}
          className="absolute select-none"
          style={{
            left: p.x,
            top: p.y,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {/* Pot */}
          <div className="flex flex-col items-center">
            <div
              className="rounded-full"
              style={{
                width: '10px',
                height: '10px',
                backgroundColor: 'rgba(34,120,60,0.25)',
                boxShadow: '0 0 4px rgba(34,120,60,0.1)',
              }}
            />
            <div
              style={{
                width: '4px',
                height: '3px',
                backgroundColor: 'rgba(120,80,40,0.25)',
                borderRadius: '0 0 2px 2px',
              }}
            />
          </div>
        </div>
      ))}

      {/* Whiteboard (top-right area) */}
      <div
        className="absolute select-none"
        style={{
          right: '8%',
          top: '10%',
          width: '32px',
          height: '20px',
          backgroundColor: 'rgba(200,200,210,0.06)',
          border: '1px solid rgba(200,200,210,0.08)',
          borderRadius: '2px',
        }}
      >
        {/* Whiteboard dots (notes) */}
        <div className="flex gap-1 p-1">
          <span className="block h-1 w-1 rounded-full bg-gray-500/20" />
          <span className="block h-1 w-3 rounded-full bg-gray-500/15" />
        </div>
        <div className="flex gap-1 px-1">
          <span className="block h-1 w-2 rounded-full bg-gray-500/10" />
        </div>
      </div>

      {/* Coffee station (bottom-left area) */}
      <div
        className="absolute select-none"
        style={{
          left: '8%',
          bottom: '10%',
          transform: 'translate(-50%, 50%)',
        }}
      >
        <div className="flex items-end gap-1">
          {/* Coffee machine */}
          <div
            style={{
              width: '8px',
              height: '12px',
              backgroundColor: 'rgba(100,80,60,0.2)',
              borderRadius: '1px',
            }}
          />
          {/* Cup */}
          <div
            style={{
              width: '5px',
              height: '5px',
              backgroundColor: 'rgba(160,132,92,0.15)',
              borderRadius: '0 0 2px 2px',
            }}
          />
        </div>
      </div>

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

      {/* Agent desk workstations - positioned absolutely using layout engine coordinates */}
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
              <DeskWorkstation
                agent={agent}
                position={pos}
                outputLines={outputLines}
                filesWorking={filesWorking}
              />
            </div>
          );
        })}
      </div>

      {/* Command Center at the middle */}
      <div style={{ zIndex: 3 }}>
        <CommandCenter
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
