import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../../test/testUtils.tsx';
import { ActiveExecutions } from './ActiveExecutions.tsx';
import { mockExecutions } from '../../../lib/mockData';

describe('ActiveExecutions', () => {
  const activeExecs = mockExecutions.filter(e => e.status === 'running' || e.status === 'queued');

  it('renders active executions', () => {
    renderWithProviders(<ActiveExecutions executions={activeExecs} />);
    expect(screen.getByText('Active Executions')).toBeInTheDocument();
  });

  it('shows execution tasks', () => {
    renderWithProviders(<ActiveExecutions executions={activeExecs} />);
    expect(screen.getByText(/Implement user authentication/)).toBeInTheDocument();
  });

  it('shows execution IDs', () => {
    renderWithProviders(<ActiveExecutions executions={activeExecs} />);
    expect(screen.getByText('#001')).toBeInTheDocument();
  });

  it('shows empty state when no executions', () => {
    renderWithProviders(<ActiveExecutions executions={[]} />);
    expect(screen.getByText('No active executions')).toBeInTheDocument();
  });

  it('renders links to execution detail pages', () => {
    renderWithProviders(<ActiveExecutions executions={activeExecs} />);
    const links = screen.getAllByRole('link');
    expect(links.some(link => link.getAttribute('href') === '/executions/exec-001')).toBe(true);
  });
});
