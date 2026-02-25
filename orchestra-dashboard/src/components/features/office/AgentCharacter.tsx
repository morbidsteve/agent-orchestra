import { useCharacterPhase } from '../../../hooks/useCharacterPhase.ts';
import type { AgentNode } from '../../../lib/types.ts';

interface AgentCharacterProps {
  agent: AgentNode;
  idlePosition: { x: number; y: number };  // percentage coords
  deskPosition: { x: number; y: number };   // percentage coords
  onClick?: () => void;
}

export function AgentCharacter({ agent, idlePosition, deskPosition, onClick }: AgentCharacterProps) {
  const phase = useCharacterPhase(agent.visualStatus);

  // Determine current position based on phase
  const atDesk =
    phase === 'walking-to-desk' ||
    phase === 'at-desk-working' ||
    phase === 'celebrating';
  const position = atDesk ? deskPosition : idlePosition;

  // Determine facing direction
  const walkingToDesk = phase === 'walking-to-desk';
  const walkingToCenter = phase === 'walking-to-center';
  const facingLeft =
    (walkingToDesk && deskPosition.x < idlePosition.x) ||
    (walkingToCenter && idlePosition.x < deskPosition.x);
  const facingRight =
    (walkingToDesk && deskPosition.x >= idlePosition.x) ||
    (walkingToCenter && idlePosition.x >= deskPosition.x);
  const flipX = facingLeft ? -1 : facingRight ? 1 : 1;

  // Animation states
  const isWalking = phase === 'walking-to-desk' || phase === 'walking-to-center';
  const isWorking = phase === 'at-desk-working';
  const isCelebrating = phase === 'celebrating';
  const isIdle = phase === 'at-center';

  // Body animation — more pronounced bob for walking
  const bodyAnimation = isWalking
    ? 'charBob 0.35s ease-in-out infinite'
    : isCelebrating
      ? 'charCelebrateJump 0.5s ease-in-out infinite'
      : isIdle
        ? 'charIdleSway 3s ease-in-out infinite'
        : 'none';

  // Arm animations — bigger swing, typing motion
  const leftArmAnimation = isWalking
    ? 'charArmSwingFwd 0.35s ease-in-out infinite'
    : isWorking
      ? 'charTypingLeft 0.25s ease-in-out infinite'
      : isCelebrating
        ? 'charCelebrateArmsL 0.5s ease-in-out infinite'
        : 'none';

  const rightArmAnimation = isWalking
    ? 'charArmSwingBack 0.35s ease-in-out infinite'
    : isWorking
      ? 'charTypingRight 0.25s ease-in-out infinite 0.12s'
      : isCelebrating
        ? 'charCelebrateArmsR 0.5s ease-in-out infinite 0.08s'
        : 'none';

  // Leg animations — more pronounced swing
  const leftLegAnimation = isWalking
    ? 'charLegSwingFwd 0.35s ease-in-out infinite'
    : 'none';

  const rightLegAnimation = isWalking
    ? 'charLegSwingBack 0.35s ease-in-out infinite'
    : 'none';

  // Hide legs when seated (working)
  const legOpacity = isWorking ? 0.2 : 0.7;

  return (
    <div
      className="absolute"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: 'translate(-50%, -100%)',
        width: '48px',
        height: '76px',
        transition: 'left 1200ms ease-in-out, top 1200ms ease-in-out',
        pointerEvents: onClick ? 'auto' : 'none',
        cursor: onClick ? 'pointer' : 'default',
        zIndex: isWalking ? 10 : 5,
      }}
      onClick={onClick}
    >
      <svg
        width="48"
        height="60"
        viewBox="0 0 48 64"
        fill="none"
        style={{
          transform: `scaleX(${flipX})`,
          display: 'block',
        }}
      >
        {/* Body group with main animation */}
        <g style={{ animation: bodyAnimation, transformOrigin: '24px 32px' }}>
          {/* Head */}
          <circle cx={24} cy={12} r={9} fill={agent.color} opacity={0.85} />
          {/* Hair/hat highlight */}
          <path d="M15 9 Q24 3 33 9" stroke={agent.color} strokeWidth="3" fill="none" opacity="0.5" />
          {/* Eyes */}
          <circle cx={20} cy={11} r={1.8} fill="#1a1d23" />
          <circle cx={28} cy={11} r={1.8} fill="#1a1d23" />
          {/* Eye glint */}
          <circle cx={20.5} cy={10.5} r={0.6} fill="rgba(255,255,255,0.6)" />
          <circle cx={28.5} cy={10.5} r={0.6} fill="rgba(255,255,255,0.6)" />
          {/* Subtle smile when working or celebrating */}
          {(isWorking || isCelebrating) && (
            <path d="M20 15 Q24 18 28 15" stroke="#1a1d23" strokeWidth="1" fill="none" opacity="0.5" />
          )}
          {/* Body torso */}
          <rect x={12} y={23} width={24} height={20} rx={5} fill={agent.color} opacity={0.65} />
          {/* Shirt collar detail */}
          <path d="M18 23 L24 28 L30 23" stroke="rgba(255,255,255,0.1)" strokeWidth="1" fill="none" />
        </g>

        {/* Left arm */}
        <g style={{ animation: leftArmAnimation, transformOrigin: '12px 27px' }}>
          <line
            x1={12} y1={27} x2={4} y2={40}
            stroke={agent.color}
            strokeWidth={3.5}
            strokeLinecap="round"
            opacity={0.7}
          />
          {/* Hand */}
          <circle cx={4} cy={40} r={2} fill={agent.color} opacity={0.6} />
        </g>

        {/* Right arm */}
        <g style={{ animation: rightArmAnimation, transformOrigin: '36px 27px' }}>
          <line
            x1={36} y1={27} x2={44} y2={40}
            stroke={agent.color}
            strokeWidth={3.5}
            strokeLinecap="round"
            opacity={0.7}
          />
          {/* Hand */}
          <circle cx={44} cy={40} r={2} fill={agent.color} opacity={0.6} />
        </g>

        {/* Left leg */}
        <g style={{ animation: leftLegAnimation, transformOrigin: '18px 43px' }}>
          <line
            x1={18} y1={43} x2={14} y2={58}
            stroke={agent.color}
            strokeWidth={3.5}
            strokeLinecap="round"
            opacity={legOpacity}
          />
          {/* Shoe */}
          <ellipse cx={13} cy={59} rx={3} ry={1.5} fill={agent.color} opacity={legOpacity * 0.8} />
        </g>

        {/* Right leg */}
        <g style={{ animation: rightLegAnimation, transformOrigin: '30px 43px' }}>
          <line
            x1={30} y1={43} x2={34} y2={58}
            stroke={agent.color}
            strokeWidth={3.5}
            strokeLinecap="round"
            opacity={legOpacity}
          />
          {/* Shoe */}
          <ellipse cx={35} cy={59} rx={3} ry={1.5} fill={agent.color} opacity={legOpacity * 0.8} />
        </g>

        {/* Celebration checkmark particle */}
        {isCelebrating && (
          <text
            x="24"
            y="4"
            textAnchor="middle"
            fontSize="8"
            fill="#22c55e"
            fontWeight="bold"
          >
            <animate attributeName="opacity" values="1;0" dur="1.5s" repeatCount="indefinite" />
            <animate attributeName="y" values="4;-2" dur="1.5s" repeatCount="indefinite" />
            {'\u2713'}
          </text>
        )}
      </svg>

      {/* Name tag below character */}
      <div
        style={{
          textAlign: 'center',
          fontSize: '9px',
          color: agent.color,
          lineHeight: '1.2',
          marginTop: '1px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontWeight: 600,
        }}
      >
        {agent.name}
      </div>
    </div>
  );
}
