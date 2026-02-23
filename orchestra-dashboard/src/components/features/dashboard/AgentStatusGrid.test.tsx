import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AgentStatusGrid } from './AgentStatusGrid.tsx';
import { mockAgents } from '../../../lib/mockData';

describe('AgentStatusGrid', () => {
  it('renders all agents', () => {
    render(<AgentStatusGrid agents={mockAgents} />);
    expect(screen.getByText('Developer (Primary)')).toBeInTheDocument();
    expect(screen.getByText('Developer (Secondary)')).toBeInTheDocument();
    expect(screen.getByText('Tester')).toBeInTheDocument();
    expect(screen.getByText('DevSecOps')).toBeInTheDocument();
    expect(screen.getByText('Business Dev')).toBeInTheDocument();
  });

  it('shows task counts', () => {
    render(<AgentStatusGrid agents={mockAgents} />);
    expect(screen.getByText('47 tasks')).toBeInTheDocument();
  });

  it('shows agent status', () => {
    render(<AgentStatusGrid agents={mockAgents} />);
    const busyTexts = screen.getAllByText('busy');
    expect(busyTexts.length).toBeGreaterThanOrEqual(2);
  });
});
