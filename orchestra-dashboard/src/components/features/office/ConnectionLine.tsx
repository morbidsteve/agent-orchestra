interface ConnectionLineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  active: boolean;
  label?: string;
}

export function ConnectionLine({ x1, y1, x2, y2, color, active }: ConnectionLineProps) {
  const filterId = `glow-${x1}-${y1}-${x2}-${y2}`;

  return (
    <g>
      {/* Glow filter for active connections */}
      {active && (
        <defs>
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" />
          </filter>
        </defs>
      )}

      {/* Outer glow line (active only) */}
      {active && (
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={color}
          strokeWidth={4}
          opacity={0.15}
          filter={`url(#${filterId})`}
          strokeLinecap="round"
        />
      )}

      {/* Main cable line */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={active ? color : '#333842'}
        strokeWidth={active ? 2.5 : 1}
        opacity={active ? 0.7 : 0.25}
        strokeLinecap="round"
      />

      {/* Subtle pulse animation overlay for active connections */}
      {active && (
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          opacity={0.4}
        >
          <animate
            attributeName="opacity"
            values="0.2;0.6;0.2"
            dur="2s"
            repeatCount="indefinite"
          />
        </line>
      )}

      {/* Directional particle animation */}
      {active && (
        <circle r={0.8} fill={color} opacity={0.9}>
          <animateMotion
            dur="1.5s"
            repeatCount="indefinite"
            path={`M${x1},${y1} L${x2},${y2}`}
          />
        </circle>
      )}
    </g>
  );
}
