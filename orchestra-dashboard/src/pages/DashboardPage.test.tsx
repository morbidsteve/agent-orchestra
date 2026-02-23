import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../test/testUtils.tsx';
import { DashboardPage } from './DashboardPage.tsx';

describe('DashboardPage', () => {
  it('renders page title', () => {
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders stats cards', () => {
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText('Total Executions')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('renders active executions section', () => {
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText('Active Executions')).toBeInTheDocument();
  });

  it('renders recent results section', () => {
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText('Recent Results')).toBeInTheDocument();
  });

  it('renders agent status grid', () => {
    renderWithProviders(<DashboardPage />);
    expect(screen.getByText('Agent Status')).toBeInTheDocument();
  });
});
