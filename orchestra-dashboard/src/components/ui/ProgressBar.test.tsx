import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ProgressBar } from './ProgressBar.tsx';
import type { PipelineStep } from '../../lib/types';

const mockSteps: PipelineStep[] = [
  { phase: 'plan', status: 'completed', agentRole: 'developer', startedAt: null, completedAt: null, output: [] },
  { phase: 'develop', status: 'running', agentRole: 'developer', startedAt: null, completedAt: null, output: [] },
  { phase: 'test', status: 'pending', agentRole: null, startedAt: null, completedAt: null, output: [] },
];

describe('ProgressBar', () => {
  it('renders all steps', () => {
    const { container } = render(<ProgressBar steps={mockSteps} />);
    // Each step should produce a segment
    const segments = container.querySelectorAll('.rounded-full');
    expect(segments.length).toBe(3);
  });

  it('colors completed steps green', () => {
    const { container } = render(<ProgressBar steps={mockSteps} />);
    const greenSegment = container.querySelector('.bg-green-500');
    expect(greenSegment).toBeInTheDocument();
  });

  it('colors running steps blue with pulse', () => {
    const { container } = render(<ProgressBar steps={mockSteps} />);
    const blueSegment = container.querySelector('.bg-accent-blue');
    expect(blueSegment).toBeInTheDocument();
  });

  it('colors pending steps with surface color', () => {
    const { container } = render(<ProgressBar steps={mockSteps} />);
    const graySegment = container.querySelector('.bg-surface-600');
    expect(graySegment).toBeInTheDocument();
  });
});
