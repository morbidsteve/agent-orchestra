/**
 * Layout engine for dynamic agent positioning in the Agent Office.
 * Arranges agents in concentric rings around the center orchestrator.
 */

export interface AgentPosition {
  x: number; // percentage (0-100)
  y: number; // percentage (0-100)
  ring: number; // which ring (0 = center, 1 = inner, 2 = outer)
}

/**
 * Calculate positions for N agents in concentric rings around center (50, 50).
 * Ring 1 (radius 28%): up to 6 agents
 * Ring 2 (radius 42%): up to 10 agents
 * Positions are stable — adding a new agent doesn't shift existing ones.
 */
export function calculateAgentPositions(count: number): AgentPosition[] {
  const positions: AgentPosition[] = [];
  const centerX = 50;
  const centerY = 50;

  // Ring definitions: [radius %, max agents, start angle offset]
  const rings: [number, number, number][] = [
    [28, 6, -90],   // Ring 1: inner ring, start at top
    [42, 10, -90],  // Ring 2: outer ring
  ];

  let placed = 0;
  for (const [radius, maxInRing, startAngle] of rings) {
    if (placed >= count) break;

    const agentsInThisRing = Math.min(count - placed, maxInRing);
    const angleStep = 360 / Math.max(agentsInThisRing, 1);

    for (let i = 0; i < agentsInThisRing; i++) {
      const angle = startAngle + i * angleStep;
      const rad = (angle * Math.PI) / 180;
      positions.push({
        x: centerX + radius * Math.cos(rad),
        y: centerY + radius * Math.sin(rad),
        ring: positions.length < 6 ? 1 : 2,
      });
      placed++;
    }
  }

  return positions;
}

/**
 * Get a stable position for an agent by index.
 * Pre-calculates for up to 16 agents so positions never shift.
 */
const MAX_PRECOMPUTED = 16;
const precomputedPositions = calculateAgentPositions(MAX_PRECOMPUTED);

export function getStablePosition(index: number): AgentPosition {
  if (index < precomputedPositions.length) {
    return precomputedPositions[index];
  }
  // Fallback for more than MAX_PRECOMPUTED agents
  const positions = calculateAgentPositions(index + 1);
  return positions[index];
}
