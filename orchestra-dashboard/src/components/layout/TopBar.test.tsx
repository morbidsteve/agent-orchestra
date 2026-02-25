import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../test/testUtils.tsx';
import { TopBar } from './TopBar.tsx';

describe('TopBar', () => {
  it('renders the logo', () => {
    renderWithProviders(<TopBar />);
    expect(screen.getByText('Orchestra')).toBeInTheDocument();
  });

  it('renders a new session tab', () => {
    renderWithProviders(<TopBar />);
    expect(screen.getByText('New Session')).toBeInTheDocument();
  });

  it('renders the new session button', () => {
    renderWithProviders(<TopBar />);
    expect(screen.getByLabelText('New session')).toBeInTheDocument();
  });

  it('renders global nav buttons', () => {
    renderWithProviders(<TopBar />);
    expect(screen.getByRole('button', { name: /agents/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /findings/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument();
  });
});
