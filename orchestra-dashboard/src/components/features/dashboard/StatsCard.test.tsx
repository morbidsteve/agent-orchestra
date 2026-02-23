import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatsCard } from './StatsCard.tsx';
import { Activity } from 'lucide-react';

describe('StatsCard', () => {
  it('renders label and value', () => {
    render(<StatsCard icon={Activity} label="Total" value={42} />);
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<StatsCard icon={Activity} label="Total" value={42} subtitle="3 queued" />);
    expect(screen.getByText('3 queued')).toBeInTheDocument();
  });

  it('does not render subtitle when not provided', () => {
    const { container } = render(<StatsCard icon={Activity} label="Total" value={42} />);
    expect(container.textContent).not.toContain('queued');
  });

  it('renders string values', () => {
    render(<StatsCard icon={Activity} label="Status" value="OK" />);
    expect(screen.getByText('OK')).toBeInTheDocument();
  });
});
