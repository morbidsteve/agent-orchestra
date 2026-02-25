import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentCharacter } from './AgentCharacter.tsx';
import type { AgentNode } from '../../../lib/types.ts';

const idleAgent: AgentNode = {
  role: 'developer',
  name: 'Developer',
  color: '#3b82f6',
  icon: 'Terminal',
  visualStatus: 'idle',
  currentTask: '',
};

const workingAgent: AgentNode = {
  ...idleAgent,
  visualStatus: 'working',
  currentTask: 'Building feature',
};

const doneAgent: AgentNode = {
  ...idleAgent,
  visualStatus: 'done',
  currentTask: '',
};

const defaultPositions = {
  idlePosition: { x: 50, y: 56 },
  hubPosition: { x: 50, y: 50 },
  deskPosition: { x: 20, y: 30 },
};

describe('AgentCharacter', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders agent name tag', () => {
    render(<AgentCharacter agent={idleAgent} {...defaultPositions} />);
    expect(screen.getByText('Developer')).toBeInTheDocument();
  });

  it('renders with SVG character body', () => {
    const { container } = render(
      <AgentCharacter agent={idleAgent} {...defaultPositions} />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute('width', '48');
    expect(svg).toHaveAttribute('height', '60');
  });

  it('positions at idle position when idle (at-center phase)', () => {
    const { container } = render(
      <AgentCharacter agent={idleAgent} {...defaultPositions} />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.left).toBe('50%');
    expect(wrapper.style.top).toBe('56%');
  });

  it('positions at hub when walking-to-hub (after transition from idle to working)', () => {
    // useCharacterPhase only triggers transitions on status *changes*,
    // so we must start idle and rerender with working
    const { container, rerender } = render(
      <AgentCharacter agent={idleAgent} {...defaultPositions} />,
    );

    rerender(<AgentCharacter agent={workingAgent} {...defaultPositions} />);

    // walking-to-hub → position is hubPosition
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.left).toBe('50%');
    expect(wrapper.style.top).toBe('50%');
  });

  it('shows task card at at-hub-pickup phase', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(
      <AgentCharacter agent={idleAgent} {...defaultPositions} />,
    );

    // Transition to working
    rerender(<AgentCharacter agent={workingAgent} {...defaultPositions} />);

    // Advance to at-hub-pickup (800ms)
    act(() => { vi.advanceTimersByTime(800); });

    // Task card is an SVG rect at x=30 y=0 width=8 height=10
    const taskCards = container.querySelectorAll('rect[x="30"][y="0"]');
    expect(taskCards.length).toBe(1);

    vi.useRealTimers();
  });

  it('shows task card during walking-to-desk phase', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(
      <AgentCharacter agent={idleAgent} {...defaultPositions} />,
    );

    rerender(<AgentCharacter agent={workingAgent} {...defaultPositions} />);

    // Advance to walking-to-desk (1400ms)
    act(() => { vi.advanceTimersByTime(1400); });

    const taskCards = container.querySelectorAll('rect[x="30"][y="0"]');
    expect(taskCards.length).toBe(1);

    vi.useRealTimers();
  });

  it('hides task card when at-desk-working', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(
      <AgentCharacter agent={idleAgent} {...defaultPositions} />,
    );

    rerender(<AgentCharacter agent={workingAgent} {...defaultPositions} />);

    // Advance to at-desk-working (2600ms)
    act(() => { vi.advanceTimersByTime(2600); });

    const taskCards = container.querySelectorAll('rect[x="30"][y="0"]');
    expect(taskCards.length).toBe(0);

    vi.useRealTimers();
  });

  it('moves to desk position when at-desk-working', () => {
    vi.useFakeTimers();
    const { container, rerender } = render(
      <AgentCharacter agent={idleAgent} {...defaultPositions} />,
    );

    rerender(<AgentCharacter agent={workingAgent} {...defaultPositions} />);

    act(() => { vi.advanceTimersByTime(2600); });

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.left).toBe('20%');
    expect(wrapper.style.top).toBe('30%');

    vi.useRealTimers();
  });

  it('shows celebration checkmark when transitioning to done', () => {
    // Render idle first, then transition to done to trigger celebrating phase
    const { container, rerender } = render(
      <AgentCharacter agent={idleAgent} {...defaultPositions} />,
    );

    rerender(<AgentCharacter agent={doneAgent} {...defaultPositions} />);

    // The checkmark is a text element with Unicode checkmark
    const checkmark = container.querySelector('text');
    expect(checkmark).toBeInTheDocument();
    expect(checkmark?.textContent).toBe('\u2713');
  });

  it('handles onClick prop', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <AgentCharacter agent={idleAgent} {...defaultPositions} onClick={onClick} />,
    );

    await user.click(screen.getByText('Developer'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('has pointer-events none when no onClick prop', () => {
    const { container } = render(
      <AgentCharacter agent={idleAgent} {...defaultPositions} />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.pointerEvents).toBe('none');
  });

  it('has pointer-events auto when onClick is provided', () => {
    const { container } = render(
      <AgentCharacter agent={idleAgent} {...defaultPositions} onClick={() => {}} />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.pointerEvents).toBe('auto');
  });

  it('uses agent color for SVG elements', () => {
    const { container } = render(
      <AgentCharacter agent={idleAgent} {...defaultPositions} />,
    );
    // Head circle should use agent color
    const headCircle = container.querySelector('circle[cx="24"][cy="12"]');
    expect(headCircle).toHaveAttribute('fill', '#3b82f6');
  });

  it('sets higher z-index when walking (walking-to-hub)', () => {
    // Must transition from idle to working to get walking-to-hub phase
    const { container, rerender } = render(
      <AgentCharacter agent={idleAgent} {...defaultPositions} />,
    );

    rerender(<AgentCharacter agent={workingAgent} {...defaultPositions} />);

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.zIndex).toBe('10');
  });

  it('sets lower z-index when not walking', () => {
    const { container } = render(
      <AgentCharacter agent={idleAgent} {...defaultPositions} />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.zIndex).toBe('5');
  });

  it('sets transition duration of 800ms for walking-to-hub phase', () => {
    // Must transition from idle to working to get walking-to-hub phase
    const { container, rerender } = render(
      <AgentCharacter agent={idleAgent} {...defaultPositions} />,
    );

    rerender(<AgentCharacter agent={workingAgent} {...defaultPositions} />);

    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.style.transition).toContain('800ms');
  });

  it('starts at desk when initialized with working status (remount fix)', () => {
    // When initialized directly with working, agent should be at desk
    // not at center — this is the remount case
    const { container } = render(
      <AgentCharacter agent={workingAgent} {...defaultPositions} />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    // Position should be deskPosition (at-desk-working phase)
    expect(wrapper.style.left).toBe('20%');
    expect(wrapper.style.top).toBe('30%');
  });
});
