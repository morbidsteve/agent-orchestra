import { useCharacterPhase } from '../../../hooks/useCharacterPhase.ts';
import type { AgentNode } from '../../../lib/types.ts';

interface AgentCharacterProps {
  agent: AgentNode;
  idlePosition: { x: number; y: number };  // percentage coords
  hubPosition: { x: number; y: number };    // orchestrator center
  deskPosition: { x: number; y: number };   // percentage coords
  onClick?: () => void;
}

export function AgentCharacter({ agent, idlePosition, hubPosition, deskPosition, onClick }: AgentCharacterProps) {
  const phase = useCharacterPhase(agent.visualStatus);

  // Determine current position based on phase
  const position = (() => {
    switch (phase) {
      case 'walking-to-hub':
      case 'at-hub-pickup':
        return hubPosition;
      case 'walking-to-desk':
      case 'at-desk-working':
      case 'celebrating':
        return deskPosition;
      case 'at-center':
      case 'walking-to-center':
      default:
        return idlePosition;
    }
  })();

  // Determine facing direction based on movement
  const facingLeft = (() => {
    if (phase === 'walking-to-hub') return hubPosition.x < idlePosition.x;
    if (phase === 'walking-to-desk') return deskPosition.x < hubPosition.x;
    if (phase === 'walking-to-center') return idlePosition.x < deskPosition.x;
    return false;
  })();
  const flipX = facingLeft ? -1 : 1;

  // Animation states
  const isWalking = phase === 'walking-to-desk' || phase === 'walking-to-center' || phase === 'walking-to-hub';
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

  const transitionDuration =
    phase === 'walking-to-hub' ? 800 :
    phase === 'walking-to-desk' ? 1200 :
    phase === 'walking-to-center' ? 1200 :
    200; // snap for non-walking phases

  return (
    <div
      className="absolute"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: 'translate(-50%, -100%)',
        width: '48px',
        height: '76px',
        transition: `left ${transitionDuration}ms ease-in-out, top ${transitionDuration}ms ease-in-out`,
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

        {/* Carried task card — appears at hub pickup, carried to desk */}
        {(phase === 'at-hub-pickup' || phase === 'walking-to-desk') && (
          <g>
            <rect x="30" y="0" width="8" height="10" rx="1" fill={agent.color} opacity="0.7" />
            <line x1="32" y1="3" x2="36" y2="3" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8" />
            <line x1="32" y1="5" x2="37" y2="5" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8" />
            <line x1="32" y1="7" x2="35" y2="7" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" />
            {phase === 'at-hub-pickup' && (
              <animate attributeName="opacity" values="0;1" dur="0.3s" fill="freeze" />
            )}
          </g>
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
