import type { AgentNode } from '../../../lib/types.ts';

interface WorkstationCardProps {
  agent: AgentNode;
  position: { x: number; y: number };
  outputLines?: string[];
  filesWorking?: string[];
  onClick?: () => void;
}

/** Abbreviated screen text based on agent status */
function getScreenContent(agent: AgentNode, outputLines: string[]): { text: string; color: string } {
  if (agent.visualStatus === 'done') return { text: '\u2713 Complete', color: '#22c55e' };
  if (agent.visualStatus === 'error') return { text: '\u2717 Error', color: '#ef4444' };
  if (agent.visualStatus === 'working') {
    const lastLine = outputLines[outputLines.length - 1];
    if (lastLine) {
      return { text: lastLine.slice(0, 22), color: '#c9d1d9' };
    }
    return { text: 'Working...', color: '#c9d1d9' };
  }
  return { text: 'Standby', color: '#6b7280' };
}

export function DeskWorkstation({ agent, position, outputLines = [], filesWorking = [], onClick }: WorkstationCardProps) {
  const isWorking = agent.visualStatus === 'working';
  const isDone = agent.visualStatus === 'done';
  const isError = agent.visualStatus === 'error';
  const isIdle = agent.visualStatus === 'idle';

  const displayFiles = filesWorking.slice(0, 3);
  const screen = getScreenContent(agent, outputLines);

  // Monitor glow color
  const monitorGlow = isWorking
    ? agent.color
    : isDone
      ? '#22c55e'
      : isError
        ? '#ef4444'
        : 'transparent';

  // Status dot color
  const statusColor = isDone
    ? '#22c55e'
    : isError
      ? '#ef4444'
      : isWorking
        ? agent.color
        : '#6b7280';

  return (
    <div
      className="absolute"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: 'translate(-50%, -50%)',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
    >
      <svg
        width="160"
        height="120"
        viewBox="0 0 160 120"
        fill="none"
        style={{ display: 'block' }}
      >
        {/* Desk shadow */}
        <ellipse cx="80" cy="78" rx="72" ry="8" fill="rgba(0,0,0,0.25)" />

        {/* Desk surface - wood grain */}
        <rect x="8" y="38" width="144" height="48" rx="6" fill="#6B4E2A" />
        <rect x="8" y="38" width="144" height="48" rx="6" fill={`url(#woodGrain-${agent.role})`} />
        {/* Desk top highlight (bevel) */}
        <rect x="8" y="38" width="144" height="4" rx="2" fill="rgba(255,255,255,0.08)" />
        {/* Desk front edge */}
        <rect x="10" y="82" width="140" height="4" rx="2" fill="#5C4033" />

        {/* Desk legs */}
        <rect x="16" y="86" width="6" height="16" rx="1" fill="#5C4033" />
        <rect x="138" y="86" width="6" height="16" rx="1" fill="#5C4033" />

        {/* Monitor - tilted slightly via transform */}
        <g transform="translate(50, 12)">
          {/* Monitor bezel */}
          <rect x="0" y="0" width="60" height="36" rx="3" fill="#1a1d23" stroke="#333842" strokeWidth="1" />
          {/* Monitor screen */}
          <rect x="3" y="3" width="54" height="28" rx="1" fill="#0d1117" />
          {/* Screen glow */}
          {monitorGlow !== 'transparent' && (
            <rect x="3" y="3" width="54" height="28" rx="1" fill={monitorGlow} opacity="0.08" />
          )}
          {/* Screen content text */}
          <text
            x="30"
            y="20"
            textAnchor="middle"
            fontSize="7"
            fontFamily="monospace"
            fill={screen.color}
            opacity={isIdle ? 0.5 : 0.9}
          >
            {screen.text}
          </text>
          {/* Pulsing cursor when working */}
          {isWorking && (
            <rect x="49" y="22" width="4" height="6" rx="1" fill="#c9d1d9" opacity="0.6">
              <animate attributeName="opacity" values="0.6;0.1;0.6" dur="1s" repeatCount="indefinite" />
            </rect>
          )}
          {/* Monitor glow top border */}
          <rect x="0" y="0" width="60" height="2" rx="1" fill={monitorGlow} opacity={monitorGlow !== 'transparent' ? 0.6 : 0} />
          {/* Monitor stand */}
          <rect x="25" y="36" width="10" height="6" rx="1" fill="#333842" />
          {/* Monitor base */}
          <rect x="18" y="42" width="24" height="3" rx="1.5" fill="#333842" />
        </g>

        {/* Keyboard */}
        <g transform="translate(55, 60)">
          <rect x="0" y="0" width="50" height="12" rx="2" fill="#2a2d35" stroke="#3a3d45" strokeWidth="0.5" />
          {/* Key rows */}
          {[0, 1, 2].map(row => (
            <g key={row}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map(col => (
                <rect
                  key={`${row}-${col}`}
                  x={3 + col * 5.5}
                  y={2 + row * 3.5}
                  width="4"
                  height="2.5"
                  rx="0.5"
                  fill="#3a3d45"
                  opacity={isWorking ? 0.8 : 0.5}
                />
              ))}
            </g>
          ))}
        </g>

        {/* Mouse */}
        <g transform="translate(112, 62)">
          <rect x="0" y="0" width="10" height="14" rx="5" fill="#2a2d35" stroke="#3a3d45" strokeWidth="0.5" />
          <line x1="5" y1="2" x2="5" y2="6" stroke="#3a3d45" strokeWidth="0.5" />
        </g>

        {/* Status indicator dot on desk corner */}
        <circle cx="24" cy="50" r="4" fill={statusColor} opacity={isIdle ? 0.3 : 0.8}>
          {isWorking && (
            <animate attributeName="opacity" values="0.8;0.3;0.8" dur="1.5s" repeatCount="indefinite" />
          )}
        </circle>

        {/* Role-specific desk accessory */}
        {(agent.role === 'developer' || agent.role === 'developer-2') && (
          <g transform="translate(18, 55)" opacity="0.4">
            {/* Coffee mug */}
            <rect x="0" y="2" width="8" height="10" rx="2" fill="#8B6914" />
            <path d="M8 4 Q12 4 12 8 Q12 12 8 12" stroke="#8B6914" strokeWidth="1" fill="none" />
            {/* Steam */}
            <path d="M3 0 Q4 -2 3 -4" stroke="rgba(200,200,200,0.3)" strokeWidth="0.5" fill="none" />
          </g>
        )}
        {agent.role === 'tester' && (
          <g transform="translate(20, 54)" opacity="0.4">
            {/* Flask */}
            <rect x="2" y="0" width="4" height="6" rx="1" fill="#22c55e" opacity="0.5" />
            <path d="M0 6 L1 12 L7 12 L8 6" fill="#22c55e" opacity="0.3" />
          </g>
        )}
        {agent.role === 'devsecops' && (
          <g transform="translate(18, 54)" opacity="0.4">
            {/* Shield */}
            <path d="M5 0 L10 2 L10 7 C10 10 5 12 5 12 C5 12 0 10 0 7 L0 2 Z" fill="#f97316" opacity="0.4" />
          </g>
        )}
        {agent.role === 'business-dev' && (
          <g transform="translate(18, 56)" opacity="0.4">
            {/* Chart */}
            <rect x="0" y="6" width="3" height="4" fill="#a855f7" opacity="0.4" />
            <rect x="4" y="3" width="3" height="7" fill="#a855f7" opacity="0.5" />
            <rect x="8" y="0" width="3" height="10" fill="#a855f7" opacity="0.6" />
          </g>
        )}
        {agent.role === 'frontend-dev' && (
          <g transform="translate(18, 54)" opacity="0.4">
            {/* Paint palette */}
            <ellipse cx="6" cy="6" rx="6" ry="5" fill="#ec4899" opacity="0.3" />
            <circle cx="3" cy="4" r="1.2" fill="#ef4444" />
            <circle cx="6" cy="3" r="1.2" fill="#3b82f6" />
            <circle cx="9" cy="5" r="1.2" fill="#22c55e" />
          </g>
        )}
        {agent.role === 'backend-dev' && (
          <g transform="translate(18, 54)" opacity="0.4">
            {/* Mini server rack */}
            <rect x="0" y="0" width="12" height="12" rx="1" fill="#8b5cf6" opacity="0.3" />
            <rect x="2" y="2" width="8" height="2" rx="0.5" fill="#8b5cf6" opacity="0.5" />
            <rect x="2" y="5" width="8" height="2" rx="0.5" fill="#8b5cf6" opacity="0.5" />
            <rect x="2" y="8" width="8" height="2" rx="0.5" fill="#8b5cf6" opacity="0.5" />
          </g>
        )}
        {agent.role === 'devops' && (
          <g transform="translate(18, 54)" opacity="0.4">
            {/* Container boxes */}
            <rect x="0" y="4" width="5" height="5" rx="0.5" fill="#eab308" opacity="0.4" />
            <rect x="6" y="4" width="5" height="5" rx="0.5" fill="#eab308" opacity="0.5" />
            <rect x="3" y="0" width="5" height="5" rx="0.5" fill="#eab308" opacity="0.6" />
          </g>
        )}

        {/* Agent name label */}
        <text
          x="80"
          y="108"
          textAnchor="middle"
          fontSize="9"
          fontFamily="system-ui, sans-serif"
          fontWeight="600"
          fill="#d1d5db"
        >
          {agent.name}
        </text>

        {/* Role label */}
        <text
          x="80"
          y="118"
          textAnchor="middle"
          fontSize="7"
          fontFamily="system-ui, sans-serif"
          fill="#6b7280"
        >
          {agent.role.replace(/-/g, ' ')}
        </text>

        {/* Current task (truncated) */}
        {agent.currentTask && (
          <text
            x="80"
            y="8"
            textAnchor="middle"
            fontSize="7"
            fontFamily="system-ui, sans-serif"
            fill="#9ca3af"
          >
            {agent.currentTask.slice(0, 30)}{agent.currentTask.length > 30 ? '...' : ''}
          </text>
        )}

        {/* File badges below desk */}
        {displayFiles.length > 0 && displayFiles.map((file, i) => {
          const filename = file.split('/').pop() || file;
          return (
            <text
              key={file}
              x="80"
              y={108 + (i + 1) * 10}
              textAnchor="middle"
              fontSize="6"
              fontFamily="monospace"
              fill="#9ca3af"
              opacity="0.6"
            >
              {filename.slice(0, 20)}
            </text>
          );
        })}

        {/* Wood grain pattern definition */}
        <defs>
          <pattern id={`woodGrain-${agent.role}`} patternUnits="userSpaceOnUse" width="160" height="48">
            <rect width="160" height="48" fill="transparent" />
            {[0, 8, 16, 24, 32, 40].map(y => (
              <line
                key={y}
                x1="0"
                y1={y}
                x2="160"
                y2={y + 2}
                stroke="rgba(139,105,20,0.15)"
                strokeWidth="0.5"
              />
            ))}
          </pattern>
        </defs>
      </svg>

      {/* Chair SVG below the desk area */}
      <div className="flex justify-center" style={{ marginTop: '-16px' }}>
        <svg width="60" height="32" viewBox="0 0 60 32" fill="none">
          {/* Backrest */}
          <path
            d="M12 0 Q30 -4 48 0 Q50 2 48 8 Q30 4 12 8 Q10 2 12 0Z"
            fill={agent.color}
            opacity={isWorking ? 0.25 : 0.1}
          />
          {/* Seat cushion */}
          <ellipse cx="30" cy="12" rx="18" ry="6" fill={agent.color} opacity={isWorking ? 0.2 : 0.08} />
          {/* Chair stem */}
          <rect x="27" y="18" width="6" height="6" rx="1" fill="#374151" opacity="0.3" />
          {/* Chair base star */}
          <line x1="30" y1="24" x2="14" y2="30" stroke="#374151" strokeWidth="2" strokeLinecap="round" opacity="0.2" />
          <line x1="30" y1="24" x2="46" y2="30" stroke="#374151" strokeWidth="2" strokeLinecap="round" opacity="0.2" />
          <line x1="30" y1="24" x2="30" y2="31" stroke="#374151" strokeWidth="2" strokeLinecap="round" opacity="0.2" />
          {/* Wheels */}
          <circle cx="14" cy="30" r="2" fill="#374151" opacity="0.25" />
          <circle cx="46" cy="30" r="2" fill="#374151" opacity="0.25" />
          <circle cx="30" cy="31" r="2" fill="#374151" opacity="0.25" />
        </svg>
      </div>
    </div>
  );
}
