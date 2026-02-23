import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SeverityBadge } from './SeverityBadge.tsx';

describe('SeverityBadge', () => {
  it('renders critical badge', () => {
    render(<SeverityBadge severity="critical" />);
    expect(screen.getByText('Critical')).toBeInTheDocument();
  });

  it('renders high badge with orange color', () => {
    render(<SeverityBadge severity="high" />);
    const badge = screen.getByText('High');
    expect(badge.className).toContain('text-orange-400');
  });

  it('renders medium badge', () => {
    render(<SeverityBadge severity="medium" />);
    expect(screen.getByText('Medium')).toBeInTheDocument();
  });

  it('renders low badge', () => {
    render(<SeverityBadge severity="low" />);
    expect(screen.getByText('Low')).toBeInTheDocument();
  });

  it('renders info badge', () => {
    render(<SeverityBadge severity="info" />);
    expect(screen.getByText('Info')).toBeInTheDocument();
  });
});
