import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../test/testUtils.tsx';
import { SessionSubNav } from './SessionSubNav.tsx';

describe('SessionSubNav', () => {
  it('renders all three sub-nav buttons', () => {
    renderWithProviders(<SessionSubNav />);
    expect(screen.getByRole('button', { name: /console/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /office/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dashboard/i })).toBeInTheDocument();
  });

  it('highlights the Console tab by default', () => {
    renderWithProviders(<SessionSubNav />);
    const consoleBtn = screen.getByRole('button', { name: /console/i });
    expect(consoleBtn.className).toContain('text-accent-blue');
  });
});
