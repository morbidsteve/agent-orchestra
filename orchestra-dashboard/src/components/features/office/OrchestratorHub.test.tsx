import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrchestratorHub } from './OrchestratorHub.tsx';

describe('OrchestratorHub', () => {
  it('renders the "Orchestrator" label', () => {
    render(<OrchestratorHub currentPhase={null} executionId={null} isActive={false} />);
    expect(screen.getByText('Orchestrator')).toBeInTheDocument();
  });

  it('shows "Ready" badge when idle (not active)', () => {
    render(<OrchestratorHub currentPhase={null} executionId={null} isActive={false} />);
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('shows the current phase badge when active', () => {
    render(<OrchestratorHub currentPhase="test" executionId="exec-001" isActive={true} />);
    expect(screen.getByText('test')).toBeInTheDocument();
    expect(screen.queryByText('Ready')).not.toBeInTheDocument();
  });

  it('shows the execution id when provided', () => {
    render(<OrchestratorHub currentPhase="develop" executionId="exec-abc" isActive={true} />);
    expect(screen.getByText('exec-abc')).toBeInTheDocument();
  });

  it('does not show execution id when null', () => {
    render(<OrchestratorHub currentPhase={null} executionId={null} isActive={false} />);
    expect(screen.queryByText('exec-')).not.toBeInTheDocument();
  });

  it('renders idle breathing style when not active', () => {
    const { container } = render(
      <OrchestratorHub currentPhase={null} executionId={null} isActive={false} />,
    );
    const styleTag = container.querySelector('style');
    expect(styleTag).not.toBeNull();
    expect(styleTag?.textContent).toContain('orchIdleBreathe');
  });

  it('does not render idle breathing style when active', () => {
    const { container } = render(
      <OrchestratorHub currentPhase="plan" executionId="exec-001" isActive={true} />,
    );
    const styleTag = container.querySelector('style');
    expect(styleTag).toBeNull();
  });
});
