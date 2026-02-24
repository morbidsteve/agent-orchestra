interface ConnectionLineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  active: boolean;
  label?: string;
}

const MARKER_ID_PREFIX = 'arrowhead';

export function ConnectionLine({ x1, y1, x2, y2, color, active, label }: ConnectionLineProps) {
  const markerId = `${MARKER_ID_PREFIX}-${x1}-${y1}-${x2}-${y2}`;
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  const activeStyle: React.CSSProperties = active
    ? {
        strokeDasharray: '8 4',
        animation: 'connectionDash 0.5s linear infinite',
      }
    : {
        strokeDasharray: '6 4',
        opacity: 0.3,
      };

  return (
    <g>
      {/* Inline keyframes via style element */}
      {active && (
        <style>{`
          @keyframes connectionDash {
            to { stroke-dashoffset: -12; }
          }
        `}</style>
      )}

      {/* Arrow marker definition */}
      <defs>
        <marker
          id={markerId}
          markerWidth="8"
          markerHeight="6"
          refX="8"
          refY="3"
          orient="auto"
          markerUnits="strokeWidth"
        >
          <polygon
            points="0 0, 8 3, 0 6"
            fill={active ? color : '#6b7280'}
          />
        </marker>
      </defs>

      {/* Connection line */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={active ? color : '#6b7280'}
        strokeWidth={active ? 2 : 1}
        markerEnd={`url(#${markerId})`}
        style={activeStyle}
      />

      {/* Label at midpoint */}
      {label && (
        <text
          x={midX}
          y={midY - 8}
          textAnchor="middle"
          className="fill-gray-400 text-[10px]"
          style={{ fontSize: '10px' }}
        >
          {label}
        </text>
      )}
    </g>
  );
}
