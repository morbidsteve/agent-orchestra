import { useReducer, useEffect } from 'react';
import type { AgentVisualStatus, CharacterPhase } from '../lib/types.ts';

/**
 * State machine hook that converts AgentVisualStatus changes into
 * CharacterPhase with timed transitions for walking animations.
 *
 * Transitions:
 *   working → walking-to-hub → (800ms) → at-hub-pickup → (1400ms) → walking-to-desk → (2600ms) → at-desk-working
 *   done    → celebrating → (2000ms) → walking-to-center → (3200ms) → at-center
 *   error   → walking-to-center → (800ms) → at-center
 *   idle    → at-center (or walking-to-center → at-center if at desk)
 */

type Action =
  | { type: 'status-change'; status: AgentVisualStatus }
  | { type: 'timer-tick'; phase: CharacterPhase };

interface State {
  phase: CharacterPhase;
  visualStatus: AgentVisualStatus;
  /** Scheduled delayed transitions: [delay, phase][] */
  pendingTimers: ReadonlyArray<[number, CharacterPhase]>;
  /** Incremented on each status change to cancel stale timers */
  generation: number;
}

function computeTransition(
  status: AgentVisualStatus,
  prevStatus: AgentVisualStatus,
): { immediatePhase: CharacterPhase; timers: Array<[number, CharacterPhase]> } {
  const wasAtDesk = prevStatus === 'working';

  if (status === 'working') {
    return {
      immediatePhase: 'walking-to-hub',
      timers: [
        [800, 'at-hub-pickup'],
        [1400, 'walking-to-desk'],
        [2600, 'at-desk-working'],
      ],
    };
  }
  if (status === 'done') {
    return {
      immediatePhase: 'celebrating',
      timers: [[2000, 'walking-to-center'], [3200, 'at-center']],
    };
  }
  if (status === 'error') {
    if (wasAtDesk) {
      return {
        immediatePhase: 'walking-to-center',
        timers: [[1200, 'at-center']],
      };
    }
    return { immediatePhase: 'at-center', timers: [] };
  }
  // idle
  if (wasAtDesk) {
    return {
      immediatePhase: 'walking-to-center',
      timers: [[1200, 'at-center']],
    };
  }
  return { immediatePhase: 'at-center', timers: [] };
}

function reducer(state: State, action: Action): State {
  if (action.type === 'status-change') {
    if (action.status === state.visualStatus) return state;
    const { immediatePhase, timers } = computeTransition(action.status, state.visualStatus);
    return {
      phase: immediatePhase,
      visualStatus: action.status,
      pendingTimers: timers,
      generation: state.generation + 1,
    };
  }
  // timer-tick — only apply if no newer generation has started
  return { ...state, phase: action.phase };
}

function initialPhaseFor(status: AgentVisualStatus): CharacterPhase {
  switch (status) {
    case 'working': return 'at-desk-working';
    case 'done': return 'celebrating';
    case 'idle':
    case 'error':
    default: return 'at-center';
  }
}

function createInitialState(visualStatus: AgentVisualStatus): State {
  return {
    phase: initialPhaseFor(visualStatus),
    visualStatus,
    pendingTimers: visualStatus === 'done'
      ? [[2000, 'walking-to-center'] as [number, CharacterPhase], [3200, 'at-center'] as [number, CharacterPhase]]
      : [],
    generation: 0,
  };
}

export function useCharacterPhase(visualStatus: AgentVisualStatus): CharacterPhase {
  const [state, dispatch] = useReducer(reducer, visualStatus, createInitialState);

  // Detect prop changes during render and dispatch synchronously.
  // This is the React-recommended pattern for derived state with useReducer.
  // See: https://react.dev/reference/react/useReducer#avoiding-recreating-the-initial-state
  if (state.visualStatus !== visualStatus) {
    dispatch({ type: 'status-change', status: visualStatus });
  }

  // Schedule delayed transitions from pendingTimers
  useEffect(() => {
    if (state.pendingTimers.length === 0) return;

    const gen = state.generation;
    const timeoutIds: ReturnType<typeof setTimeout>[] = [];

    for (const [delay, phase] of state.pendingTimers) {
      const id = setTimeout(() => {
        // Only apply if generation hasn't changed (checked via closure)
        if (gen === state.generation) {
          dispatch({ type: 'timer-tick', phase });
        }
      }, delay);
      timeoutIds.push(id);
    }

    return () => {
      for (const id of timeoutIds) {
        clearTimeout(id);
      }
    };
  }, [state.generation, state.pendingTimers]);

  return state.phase;
}
