import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OfficeCanvas } from './OfficeCanvas.tsx';
import type { OfficeState, AgentNode, AgentConnection } from '../../../lib/types.ts';

const defaultAgents: AgentNode[] = [
  { role: 'developer', name: 'Developer', color: '#3b82f6', icon: 'Terminal', visualStatus: 'idle', currentTask: '' },
  { role: 'developer-2', name: 'Developer 2', color: '#06b6d4', icon: 'Code', visualStatus: 'idle', currentTask: '' },
  { role: 'tester', name: 'Tester', color: '#22c55e', icon: 'FlaskConical', visualStatus: 'idle', currentTask: '' },
  { role: 'devsecops', name: 'DevSecOps', color: '#f97316', icon: 'Shield', visualStatus: 'idle', currentTask: '' },
  { role: 'business-dev', name: 'Business Dev', color: '#a855f7', icon: 'Briefcase', visualStatus: 'idle', currentTask: '' },
];

function makeOfficeState(overrides?: Partial<OfficeState>): OfficeState {
  return {
    agents: defaultAgents,
    connections: [],
    currentPhase: null,
    executionId: null,
    ...overrides,
  };
}

describe('OfficeCanvas', () => {
  it('renders all agent desks', () => {
    render(<OfficeCanvas officeState={makeOfficeState()} />);
    expect(screen.getByText('Developer')).toBeInTheDocument();
    expect(screen.getByText('Developer 2')).toBeInTheDocument();
    expect(screen.getByText('Tester')).toBeInTheDocument();
    expect(screen.getByText('DevSecOps')).toBeInTheDocument();
    expect(screen.getByText('Business Dev')).toBeInTheDocument();
  });

  it('renders the orchestrator hub', () => {
    render(<OfficeCanvas officeState={makeOfficeState()} />);
    expect(screen.getByText('Orchestrator')).toBeInTheDocument();
  });

  it('renders default idle connections when no active connections exist', () => {
    const { container } = render(<OfficeCanvas officeState={makeOfficeState()} />);

    // There should be SVG line elements for the 5 default idle connections
    // (orchestrator -> developer, developer-2, tester, devsecops, business-dev)
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();

    const lines = svg!.querySelectorAll('line');
    expect(lines.length).toBe(5);
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
    const lines = svg!.querySelectorAll('line');
    // Should show 2 explicit connections, not the 5 defaults
    expect(lines.length).toBe(2);
  });

  it('shows "Ready" badge on orchestrator when idle', () => {
    render(<OfficeCanvas officeState={makeOfficeState()} />);
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('shows current phase on orchestrator when active', () => {
    render(
      <OfficeCanvas
        officeState={makeOfficeState({
          executionId: 'exec-001',
          currentPhase: 'develop',
        })}
      />,
    );
    expect(screen.getByText('develop')).toBeInTheDocument();
  });

  it('shows idle status text on idle agents', () => {
    render(<OfficeCanvas officeState={makeOfficeState()} />);
    expect(screen.getByText('Ready to code')).toBeInTheDocument();
    expect(screen.getByText('Standing by')).toBeInTheDocument();
    expect(screen.getByText('Awaiting tests')).toBeInTheDocument();
    expect(screen.getByText('Monitoring')).toBeInTheDocument();
    expect(screen.getByText('Analyzing')).toBeInTheDocument();
  });

  it('shows working status for active agents', () => {
    const workingAgents = defaultAgents.map(a =>
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
