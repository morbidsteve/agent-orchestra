import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PipelineTimeline } from './PipelineTimeline.tsx';
import type { PipelineStep } from '../../../lib/types';

const mockSteps: PipelineStep[] = [
  { phase: 'plan', status: 'completed', agentRole: 'developer', startedAt: '2025-01-01T00:00:00Z', completedAt: '2025-01-01T00:03:00Z', output: [] },
  { phase: 'develop', status: 'completed', agentRole: 'developer', startedAt: '2025-01-01T00:03:00Z', completedAt: '2025-01-01T00:10:00Z', output: [] },
  { phase: 'test', status: 'running', agentRole: 'tester', startedAt: '2025-01-01T00:10:00Z', completedAt: null, output: [] },
  { phase: 'security', status: 'pending', agentRole: null, startedAt: null, completedAt: null, output: [] },
  { phase: 'report', status: 'pending', agentRole: null, startedAt: null, completedAt: null, output: [] },
];

describe('PipelineTimeline', () => {
  it('renders Pipeline Progress heading', () => {
    render(<PipelineTimeline steps={mockSteps} />);
    expect(screen.getByText('Pipeline Progress')).toBeInTheDocument();
  });

  it('renders all phase labels', () => {
    render(<PipelineTimeline steps={mockSteps} />);
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('Develop')).toBeInTheDocument();
    expect(screen.getByText('Test')).toBeInTheDocument();
    expect(screen.getByText('Security')).toBeInTheDocument();
    expect(screen.getByText('Report')).toBeInTheDocument();
  });

  it('shows spinning animation for running phase', () => {
    const { container } = render(<PipelineTimeline steps={mockSteps} />);
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });
});
