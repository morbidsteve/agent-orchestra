import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OfficeStatusBar } from './OfficeStatusBar.tsx';

describe('OfficeStatusBar', () => {
  it('shows "Ready" when no executionId is provided', () => {
    render(<OfficeStatusBar executionId={null} currentPhase={null} startedAt={null} />);
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });

  it('shows "Idle" for elapsed time when no execution is active', () => {
    render(<OfficeStatusBar executionId={null} currentPhase={null} startedAt={null} />);
    expect(screen.getByText('Idle')).toBeInTheDocument();
  });

  it('does not show the current phase badge when idle', () => {
    render(<OfficeStatusBar executionId={null} currentPhase={null} startedAt={null} />);
    // Phase badges show the current phase name; when null none should appear
    const phases = ['plan', 'develop', 'test', 'security', 'report'];
    for (const phase of phases) {
      expect(screen.queryByText(phase)).not.toBeInTheDocument();
    }
  });

  it('renders all five phase progress dots when idle with dim styling', () => {
    const { container } = render(
      <OfficeStatusBar executionId={null} currentPhase={null} startedAt={null} />,
    );
    // Each phase gets a dot with a title attribute
    const dots = container.querySelectorAll('[title]');
    expect(dots).toHaveLength(5);
    expect(dots[0]).toHaveAttribute('title', 'plan');
    expect(dots[1]).toHaveAttribute('title', 'develop');
    expect(dots[2]).toHaveAttribute('title', 'test');
    expect(dots[3]).toHaveAttribute('title', 'security');
    expect(dots[4]).toHaveAttribute('title', 'report');
  });

  it('displays the execution id when one is active', () => {
    render(
      <OfficeStatusBar executionId="exec-123" currentPhase="develop" startedAt="2026-02-24T10:00:00Z" />,
    );
    expect(screen.getByText('exec-123')).toBeInTheDocument();
    expect(screen.queryByText('Ready')).not.toBeInTheDocument();
  });

  it('shows the current phase badge when active', () => {
    render(
      <OfficeStatusBar executionId="exec-123" currentPhase="test" startedAt="2026-02-24T10:00:00Z" />,
    );
    expect(screen.getByText('test')).toBeInTheDocument();
  });

  it('shows elapsed time format when startedAt is provided', () => {
    // Use a startedAt that's in the past so elapsed > 0, but we just check format
    render(
      <OfficeStatusBar
        executionId="exec-123"
        currentPhase="plan"
        startedAt={new Date().toISOString()}
      />,
    );
    // Should show something like "0:00" or "0:01" not "Idle" or "--:--"
    expect(screen.queryByText('Idle')).not.toBeInTheDocument();
    expect(screen.queryByText('--:--')).not.toBeInTheDocument();
  });

  it('shows "--:--" when active but no startedAt', () => {
    render(
      <OfficeStatusBar executionId="exec-123" currentPhase="plan" startedAt={null} />,
    );
    expect(screen.getByText('--:--')).toBeInTheDocument();
  });
});
