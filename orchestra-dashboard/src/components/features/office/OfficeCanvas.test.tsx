import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OfficeCanvas } from './OfficeCanvas.tsx';
import type { OfficeState, AgentNode, AgentConnection } from '../../../lib/types.ts';

/** Test fixture — simulates agents that would be created dynamically at runtime. */
const testAgents: AgentNode[] = [
  { role: 'developer', name: 'Developer', color: '#3b82f6', icon: 'Terminal', visualStatus: 'idle', currentTask: '' },
  { role: 'developer-2', name: 'Developer 2', color: '#06b6d4', icon: 'Code', visualStatus: 'idle', currentTask: '' },
  { role: 'tester', name: 'Tester', color: '#22c55e', icon: 'FlaskConical', visualStatus: 'idle', currentTask: '' },
  { role: 'devsecops', name: 'DevSecOps', color: '#f97316', icon: 'Shield', visualStatus: 'idle', currentTask: '' },
  { role: 'business-dev', name: 'Business Dev', color: '#a855f7', icon: 'Briefcase', visualStatus: 'idle', currentTask: '' },
];

function makeOfficeState(overrides?: Partial<OfficeState>): OfficeState {
  return {
    agents: testAgents,
    connections: [],
    currentPhase: null,
    executionId: null,
    ...overrides,
  };
}

describe('OfficeCanvas', () => {
  it('renders all agent desks', () => {
    render(<OfficeCanvas officeState={makeOfficeState()} />);
    // Each agent name appears twice: once in DeskWorkstation, once in AgentCharacter name tag
    expect(screen.getAllByText('Developer').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Developer 2').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Tester').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('DevSecOps').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Business Dev').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the orchestrator hub', () => {
    render(<OfficeCanvas officeState={makeOfficeState()} />);
    expect(screen.getByText('Orchestrator')).toBeInTheDocument();
  });

  it('renders idle connections derived from agents when no active connections exist', () => {
    const { container } = render(<OfficeCanvas officeState={makeOfficeState()} />);

    // Idle connections are now derived from the agents list (one per agent)
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();

    const lines = svg!.querySelectorAll('line');
    expect(lines.length).toBe(5);
  });

  it('renders empty office with no connections when no agents exist', () => {
    const { container } = render(
      <OfficeCanvas officeState={makeOfficeState({ agents: [] })} />,
    );

    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();

    // No agents means no idle connections
    const lines = svg!.querySelectorAll('line');
    expect(lines.length).toBe(0);
  });

  it('renders explicit connections instead of defaults when connections are provided', () => {
    const activeConnections: AgentConnection[] = [
      { from: 'orchestrator', to: 'developer', label: 'plan -> develop', active: true, dataFlow: 'handoff' },
      { from: 'developer', to: 'tester', label: 'develop -> test', active: false, dataFlow: 'handoff' },
    ];

    const { container } = render(
      <OfficeCanvas officeState={makeOfficeState({ connections: activeConnections })} />,
    );

    const svg = container.querySelector('svg');
    // Each active connection renders 3 lines (glow + cable + pulse), each idle renders 1
    // 1 active connection (3 lines) + 1 idle connection (1 line) = 4 lines total
    const lines = svg!.querySelectorAll('line');
    expect(lines.length).toBe(4);
  });

  it('shows "Ready" badge on orchestrator when idle', () => {
    render(<OfficeCanvas officeState={makeOfficeState()} />);
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('shows status on orchestrator when active', () => {
    render(
      <OfficeCanvas
        officeState={makeOfficeState({
          executionId: 'exec-001',
          currentPhase: 'develop',
        })}
      />,
    );
    // CommandCenter shows "Delegating to N agents" when agents are present
    expect(screen.getByText('Delegating to 5 agents')).toBeInTheDocument();
  });

  it('shows role labels on idle agent workstation cards', () => {
    render(<OfficeCanvas officeState={makeOfficeState()} />);
    // DeskWorkstation bottom bar shows agent.role with dashes replaced by spaces
    expect(screen.getByText('developer')).toBeInTheDocument();
    expect(screen.getByText('developer 2')).toBeInTheDocument();
    expect(screen.getByText('tester')).toBeInTheDocument();
    expect(screen.getByText('devsecops')).toBeInTheDocument();
    expect(screen.getByText('business dev')).toBeInTheDocument();
  });

  it('shows working status for active agents', () => {
    const workingAgents = testAgents.map(a =>
      a.role === 'developer'
        ? { ...a, visualStatus: 'working' as const, currentTask: 'Implementing feature' }
        : a,
    );

    render(
      <OfficeCanvas
        officeState={makeOfficeState({
          agents: workingAgents,
          executionId: 'exec-001',
          currentPhase: 'develop',
        })}
      />,
    );

    expect(screen.getByText('Implementing feature')).toBeInTheDocument();
  });
});
