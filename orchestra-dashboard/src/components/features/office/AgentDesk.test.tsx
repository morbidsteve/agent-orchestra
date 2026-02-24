import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentDesk } from './AgentDesk.tsx';
import type { AgentNode } from '../../../lib/types.ts';

function makeAgent(overrides?: Partial<AgentNode>): AgentNode {
  return {
    role: 'developer',
    name: 'Developer',
    color: '#3b82f6',
    icon: 'Terminal',
    visualStatus: 'idle',
    currentTask: '',
    ...overrides,
  };
}

describe('AgentDesk', () => {
  it('renders the agent name', () => {
    render(<AgentDesk agent={makeAgent()} />);
    expect(screen.getByText('Developer')).toBeInTheDocument();
  });

  it('shows idle status text when agent is idle and has no current task', () => {
    render(<AgentDesk agent={makeAgent({ role: 'developer', visualStatus: 'idle', currentTask: '' })} />);
    expect(screen.getByText('Ready to code')).toBeInTheDocument();
  });

  it('shows correct idle text for each agent role', () => {
    const roles: Record<string, string> = {
      'developer': 'Ready to code',
      'developer-2': 'Standing by',
      'tester': 'Awaiting tests',
      'devsecops': 'Monitoring',
      'business-dev': 'Analyzing',
    };

    for (const [role, expectedText] of Object.entries(roles)) {
      const { unmount } = render(
        <AgentDesk agent={makeAgent({ role, name: role, visualStatus: 'idle', currentTask: '' })} />,
      );
      expect(screen.getByText(expectedText)).toBeInTheDocument();
      unmount();
    }
  });

  it('shows fallback idle text for unknown roles', () => {
    render(<AgentDesk agent={makeAgent({ role: 'unknown-role', visualStatus: 'idle', currentTask: '' })} />);
    expect(screen.getByText('Standing by')).toBeInTheDocument();
  });

  it('does not show idle text when agent has a current task', () => {
    render(
      <AgentDesk agent={makeAgent({ visualStatus: 'idle', currentTask: 'Deploying build' })} />,
    );
    expect(screen.getByText('Deploying build')).toBeInTheDocument();
    expect(screen.queryByText('Ready to code')).not.toBeInTheDocument();
  });

  it('does not show idle text when agent is working', () => {
    render(
      <AgentDesk agent={makeAgent({ visualStatus: 'working', currentTask: 'Writing code' })} />,
    );
    expect(screen.getByText('Writing code')).toBeInTheDocument();
    expect(screen.queryByText('Ready to code')).not.toBeInTheDocument();
  });

  it('renders current task text when agent is working', () => {
    render(
      <AgentDesk agent={makeAgent({ visualStatus: 'working', currentTask: 'Implementing feature X' })} />,
    );
    expect(screen.getByText('Implementing feature X')).toBeInTheDocument();
  });

  it('renders idle breathing style tag when idle', () => {
    const { container } = render(<AgentDesk agent={makeAgent({ visualStatus: 'idle' })} />);
    const styleTag = container.querySelector('style');
    expect(styleTag).not.toBeNull();
    expect(styleTag?.textContent).toContain('idleBreathe');
  });

  it('does not render idle breathing style when working', () => {
    const { container } = render(
      <AgentDesk agent={makeAgent({ visualStatus: 'working', currentTask: 'Working' })} />,
    );
    const styleTag = container.querySelector('style');
    // When not idle, no style tag for idle breathing
    expect(styleTag).toBeNull();
  });
});
