import { DeskWorkstation } from './WorkstationCard.tsx';
import { CommandCenter } from './OrchestratorDesk.tsx';
import { ConnectionLine } from './ConnectionLine.tsx';
import { AgentCharacter } from './AgentCharacter.tsx';
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

const CENTER = { x: 50, y: 50 };

/** Compute idle cluster positions in a small arc below the orchestrator */
function getIdlePosition(index: number, total: number): { x: number; y: number } {
  const centerX = 50;
  const centerY = 56; // slightly below center (orchestrator is at 50,50)
  const radius = 8;   // 8% radius arc
  const startAngle = -180; // arc from left to right (bottom semicircle)
  const angleStep = total > 1 ? 160 / (total - 1) : 0;
  const angle = startAngle + 10 + index * angleStep; // 10deg offset from edge
  const rad = (angle * Math.PI) / 180;
  return {
    x: centerX + radius * Math.cos(rad),
    y: centerY + radius * Math.sin(rad),
  };
}

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

  // Show explicit + orchestrator connections when any exist, idle defaults otherwise.
  // Derive idle connections from current agents instead of a hardcoded list.
  const hasActivity = connections.length > 0 || orchestratorConnections.length > 0;
  const idleConnections: AgentConnection[] = agents.map(a => ({
    from: 'orchestrator',
    to: a.role,
    label: '',
    active: false,
    dataFlow: 'handoff' as const,
  }));
  const mergedConnections = hasActivity
    ? [...orchestratorConnections, ...connections]
    : idleConnections;
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
      {/* SVG connection layer - viewBox maps to percentage coords */}
      {/* NOTE: This must be the first <svg> in the DOM so tests can find it via querySelector('svg') */}
      <svg
        className="absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ pointerEvents: 'none', zIndex: 1 }}
      >
        {displayConnections.map((conn) => {
          const fromPos = conn.from === 'orchestrator' ? CENTER : (agentPositions.get(conn.from) || CENTER);
          const toPos = conn.to === 'orchestrator' ? CENTER : (agentPositions.get(conn.to) || CENTER);
          const color = agents.find(a => a.role === conn.from)?.color || AGENT_COLORS[conn.from] || '#6b7280';

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

      {/* Decorative potted plants */}
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
          <div className="flex flex-col items-center">
            <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
              {/* Leaves */}
              <ellipse cx="8" cy="6" rx="5" ry="4" fill="rgba(34,120,60,0.3)" />
              <ellipse cx="5" cy="8" rx="3" ry="3" fill="rgba(34,140,50,0.25)" />
              <ellipse cx="11" cy="8" rx="3" ry="3" fill="rgba(34,140,50,0.25)" />
              {/* Pot */}
              <path d="M5 13 L4 18 L12 18 L11 13 Z" fill="rgba(140,90,50,0.3)" />
              <rect x="4" y="12" width="8" height="2" rx="1" fill="rgba(160,100,60,0.35)" />
            </svg>
          </div>
        </div>
      ))}

      {/* Water cooler (top-left area) */}
      <div className="absolute select-none" style={{ left: '12%', top: '12%', transform: 'translate(-50%, -50%)' }}>
        <svg width="12" height="24" viewBox="0 0 12 24" fill="none">
          {/* Water jug */}
          <rect x="2" y="0" width="8" height="10" rx="2" fill="rgba(59,130,246,0.12)" stroke="rgba(59,130,246,0.08)" strokeWidth="0.5" />
          {/* Dispenser body */}
          <rect x="1" y="10" width="10" height="10" rx="1" fill="rgba(200,200,210,0.08)" stroke="rgba(200,200,210,0.06)" strokeWidth="0.5" />
          {/* Base */}
          <rect x="0" y="20" width="12" height="4" rx="1" fill="rgba(200,200,210,0.06)" />
        </svg>
      </div>

      {/* Filing cabinet (left side) */}
      <div className="absolute select-none" style={{ left: '7%', top: '50%', transform: 'translate(-50%, -50%)' }}>
        <svg width="14" height="28" viewBox="0 0 14 28" fill="none">
          <rect x="0" y="0" width="14" height="8" rx="1" fill="rgba(100,100,120,0.08)" stroke="rgba(100,100,120,0.06)" strokeWidth="0.5" />
          <rect x="5" y="3" width="4" height="2" rx="0.5" fill="rgba(100,100,120,0.1)" />
          <rect x="0" y="10" width="14" height="8" rx="1" fill="rgba(100,100,120,0.08)" stroke="rgba(100,100,120,0.06)" strokeWidth="0.5" />
          <rect x="5" y="13" width="4" height="2" rx="0.5" fill="rgba(100,100,120,0.1)" />
          <rect x="0" y="20" width="14" height="8" rx="1" fill="rgba(100,100,120,0.08)" stroke="rgba(100,100,120,0.06)" strokeWidth="0.5" />
          <rect x="5" y="23" width="4" height="2" rx="0.5" fill="rgba(100,100,120,0.1)" />
        </svg>
      </div>

      {/* Whiteboard (top-right area) */}
      <div className="absolute select-none" style={{ right: '6%', top: '10%' }}>
        <svg width="48" height="32" viewBox="0 0 48 32" fill="none">
          {/* Board surface */}
          <rect x="0" y="0" width="48" height="28" rx="2" fill="rgba(200,200,210,0.06)" stroke="rgba(200,200,210,0.1)" strokeWidth="0.5" />
          {/* Content lines */}
          <line x1="4" y1="6" x2="20" y2="6" stroke="rgba(59,130,246,0.15)" strokeWidth="1" />
          <line x1="4" y1="11" x2="30" y2="11" stroke="rgba(200,200,210,0.08)" strokeWidth="0.5" />
          <line x1="4" y1="15" x2="25" y2="15" stroke="rgba(200,200,210,0.08)" strokeWidth="0.5" />
          <line x1="4" y1="19" x2="18" y2="19" stroke="rgba(200,200,210,0.08)" strokeWidth="0.5" />
          {/* Sticky note */}
          <rect x="32" y="4" width="10" height="10" rx="1" fill="rgba(250,204,21,0.08)" />
          {/* Marker tray */}
          <rect x="8" y="28" width="32" height="3" rx="1" fill="rgba(100,100,120,0.06)" />
          <circle cx="16" cy="29.5" r="1" fill="rgba(239,68,68,0.15)" />
          <circle cx="22" cy="29.5" r="1" fill="rgba(59,130,246,0.15)" />
          <circle cx="28" cy="29.5" r="1" fill="rgba(34,197,94,0.15)" />
        </svg>
      </div>

      {/* Coffee station (bottom-left area) */}
      <div className="absolute select-none" style={{ left: '8%', bottom: '10%', transform: 'translate(-50%, 50%)' }}>
        <svg width="24" height="20" viewBox="0 0 24 20" fill="none">
          {/* Coffee machine */}
          <rect x="0" y="2" width="12" height="14" rx="2" fill="rgba(100,80,60,0.15)" stroke="rgba(100,80,60,0.1)" strokeWidth="0.5" />
          <rect x="2" y="5" width="8" height="5" rx="1" fill="rgba(80,60,40,0.12)" />
          <rect x="3" y="12" width="2" height="3" rx="0.5" fill="rgba(160,132,92,0.15)" />
          {/* Coffee cup */}
          <rect x="16" y="10" width="7" height="8" rx="2" fill="rgba(160,132,92,0.12)" stroke="rgba(160,132,92,0.1)" strokeWidth="0.5" />
          {/* Steam */}
          <path d="M18 8 Q19 6 18 4" stroke="rgba(160,132,92,0.12)" strokeWidth="0.5" fill="none" />
          <path d="M20 9 Q21 7 20 5" stroke="rgba(160,132,92,0.1)" strokeWidth="0.5" fill="none" />
        </svg>
      </div>

      {/* Meeting table (center area, above command center) */}
      <div className="absolute select-none" style={{ left: '50%', top: '36%', transform: 'translate(-50%, -50%)' }}>
        <svg width="40" height="16" viewBox="0 0 40 16" fill="none">
          <ellipse cx="20" cy="8" rx="18" ry="6" fill="rgba(100,80,60,0.08)" stroke="rgba(100,80,60,0.06)" strokeWidth="0.5" />
          {/* Small documents on table */}
          <rect x="10" y="5" width="5" height="6" rx="0.5" fill="rgba(200,200,210,0.05)" />
          <rect x="24" y="5" width="5" height="6" rx="0.5" fill="rgba(200,200,210,0.05)" />
        </svg>
      </div>

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

      {/* Walking character layer */}
      <div className="absolute inset-0" style={{ zIndex: 4, pointerEvents: 'none' }}>
        {agents.map((agent, index) => {
          const deskPos = agentPositions.get(agent.role);
          if (!deskPos) return null;
          const idlePos = getIdlePosition(index, agents.length);
          return (
            <AgentCharacter
              key={agent.role}
              agent={agent}
              idlePosition={idlePos}
              deskPosition={{ x: deskPos.x, y: deskPos.y - 4 }}
            />
          );
        })}
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
        @keyframes agentBob {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        @keyframes legSwingForward {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(25deg); }
        }
        @keyframes legSwingBack {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-25deg); }
        }
        @keyframes armSwingForward {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(20deg); }
        }
        @keyframes armSwingBack {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(-20deg); }
        }
        @keyframes typingBob {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(3deg); }
        }
        @keyframes idleSway {
          0%, 100% { transform: translate(0, 0) rotate(0deg); }
          50% { transform: translate(1px, 0) rotate(0.5deg); }
        }
        @keyframes celebrateJump {
          0%, 100% { transform: translateY(0); }
          30% { transform: translateY(-10px); }
          50% { transform: translateY(-6px); }
          70% { transform: translateY(-8px); }
        }
        @keyframes celebrateArms {
          0%, 100% { transform: rotate(0deg); }
          30% { transform: rotate(-70deg); }
          70% { transform: rotate(-70deg); }
        }
      `}</style>
    </div>
  );
}
