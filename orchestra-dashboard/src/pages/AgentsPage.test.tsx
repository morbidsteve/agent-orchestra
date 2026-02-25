import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../test/testUtils.tsx';
import { AgentsPage } from './AgentsPage.tsx';

describe('AgentsPage', () => {
  it('renders page title', () => {
    renderWithProviders(<AgentsPage />);
    expect(screen.getByText('Agents')).toBeInTheDocument();
  });

  it('shows online/offline count', () => {
    renderWithProviders(<AgentsPage />);
    expect(screen.getByText(/7 online/)).toBeInTheDocument();
    expect(screen.getByText(/1 offline/)).toBeInTheDocument();
  });

  it('renders all agent cards', () => {
    renderWithProviders(<AgentsPage />);
    expect(screen.getByText('Developer (Primary)')).toBeInTheDocument();
    expect(screen.getByText('Tester')).toBeInTheDocument();
    expect(screen.getByText('DevSecOps')).toBeInTheDocument();
  });
});
