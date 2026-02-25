import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OfficeCanvas } from './OfficeCanvas.tsx';
import type { OfficeState, AgentNode } from '../../../lib/types.ts';

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

  it('does not render connection lines (removed in visual overhaul)', () => {
    const { container } = render(<OfficeCanvas officeState={makeOfficeState()} />);

    // Connection lines have been removed — characters walk instead.
    // Verify no SVG connection overlay with <line> elements between orchestrator and agents.
    // The first SVG in the DOM should be from a desk/character, not a connection overlay.
    const svgs = container.querySelectorAll('svg[viewBox="0 0 100 100"]');
    expect(svgs.length).toBe(0);
  });

  it('renders empty office when no agents exist', () => {
    render(
      <OfficeCanvas officeState={makeOfficeState({ agents: [] })} />,
    );

    // Orchestrator hub should still be visible
    expect(screen.getByText('Orchestrator')).toBeInTheDocument();
  });

  it('opens agent popup when clicking a desk workstation', async () => {
    const user = userEvent.setup();
    const agentOutputMap = new Map<string, string[]>();
    agentOutputMap.set('developer', ['Building feature...', 'Running tests...']);

    render(
      <OfficeCanvas
        officeState={makeOfficeState()}
        agentOutputMap={agentOutputMap}
      />,
    );

    // Click on the Developer text in the desk (first match)
    const devLabels = screen.getAllByText('Developer');
    await user.click(devLabels[0]);

    // Popup should show agent details
    expect(screen.getByText('Current Task')).toBeInTheDocument();
    expect(screen.getByLabelText('Close popup')).toBeInTheDocument();
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
