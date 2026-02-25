import { useCharacterPhase } from '../../../hooks/useCharacterPhase.ts';
import type { AgentNode } from '../../../lib/types.ts';

interface AgentCharacterProps {
  agent: AgentNode;
  idlePosition: { x: number; y: number };  // percentage coords
  deskPosition: { x: number; y: number };   // percentage coords
}

export function AgentCharacter({ agent, idlePosition, deskPosition }: AgentCharacterProps) {
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

  // Body animation
  const bodyAnimation = isWalking
    ? 'agentBob 0.4s ease-in-out infinite'
    : isCelebrating
      ? 'celebrateJump 0.6s ease-in-out infinite'
      : isIdle
        ? 'idleSway 3s ease-in-out infinite'
        : 'none';

  // Arm animations
  const leftArmAnimation = isWalking
    ? 'armSwingForward 0.4s ease-in-out infinite'
    : isWorking
      ? 'typingBob 0.3s ease-in-out infinite'
      : isCelebrating
        ? 'celebrateArms 0.6s ease-in-out infinite'
        : 'none';

  const rightArmAnimation = isWalking
    ? 'armSwingBack 0.4s ease-in-out infinite'
    : isWorking
      ? 'typingBob 0.3s ease-in-out infinite 0.15s'
      : isCelebrating
        ? 'celebrateArms 0.6s ease-in-out infinite 0.1s'
        : 'none';

  // Leg animations
  const leftLegAnimation = isWalking
    ? 'legSwingForward 0.4s ease-in-out infinite'
    : 'none';

  const rightLegAnimation = isWalking
    ? 'legSwingBack 0.4s ease-in-out infinite'
    : 'none';

  return (
    <div
      className="absolute"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: 'translate(-50%, -100%)',
        width: '48px',
        height: '72px',
        transition: 'left 800ms ease-in-out, top 800ms ease-in-out',
        pointerEvents: 'none',
      }}
    >
      <svg
        width="48"
        height="56"
        viewBox="0 0 40 56"
        fill="none"
        style={{
          transform: `scaleX(${flipX})`,
          display: 'block',
        }}
      >
        {/* Body group with main animation */}
        <g style={{ animation: bodyAnimation, transformOrigin: '20px 28px' }}>
          {/* Head */}
          <circle cx={20} cy={10} r={8} fill={agent.color} opacity={0.8} />
          {/* Eyes */}
          <circle cx={17} cy={9} r={1.5} fill="#1a1d23" />
          <circle cx={23} cy={9} r={1.5} fill="#1a1d23" />
          {/* Body */}
          <rect x={10} y={20} width={20} height={18} rx={4} fill={agent.color} opacity={0.6} />
        </g>

        {/* Left arm */}
        <g style={{ animation: leftArmAnimation, transformOrigin: '10px 24px' }}>
          <line
            x1={10} y1={24} x2={4} y2={34}
            stroke={agent.color}
            strokeWidth={3}
            strokeLinecap="round"
            opacity={0.7}
          />
        </g>

        {/* Right arm */}
        <g style={{ animation: rightArmAnimation, transformOrigin: '30px 24px' }}>
          <line
            x1={30} y1={24} x2={36} y2={34}
            stroke={agent.color}
            strokeWidth={3}
            strokeLinecap="round"
            opacity={0.7}
          />
        </g>

        {/* Left leg */}
        <g style={{ animation: leftLegAnimation, transformOrigin: '15px 38px' }}>
          <line
            x1={15} y1={38} x2={12} y2={52}
            stroke={agent.color}
            strokeWidth={3}
            strokeLinecap="round"
            opacity={0.7}
          />
        </g>

        {/* Right leg */}
        <g style={{ animation: rightLegAnimation, transformOrigin: '25px 38px' }}>
          <line
            x1={25} y1={38} x2={28} y2={52}
            stroke={agent.color}
            strokeWidth={3}
            strokeLinecap="round"
            opacity={0.7}
          />
        </g>
      </svg>

      {/* Name tag below character */}
      <div
        style={{
          textAlign: 'center',
          fontSize: '9px',
          color: agent.color,
          lineHeight: '1',
          marginTop: '1px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {agent.name}
      </div>
    </div>
  );
}
