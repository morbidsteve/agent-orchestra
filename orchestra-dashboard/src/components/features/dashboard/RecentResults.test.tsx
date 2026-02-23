import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../../test/testUtils.tsx';
import { RecentResults } from './RecentResults.tsx';
import { mockExecutions } from '../../../lib/mockData';

describe('RecentResults', () => {
  const completedExecs = mockExecutions.filter(e => e.status === 'completed' || e.status === 'failed');

  it('renders recent results heading', () => {
    renderWithProviders(<RecentResults executions={completedExecs} />);
    expect(screen.getByText('Recent Results')).toBeInTheDocument();
  });

  it('shows completed executions', () => {
    renderWithProviders(<RecentResults executions={completedExecs} />);
    expect(screen.getByText(/Review PR #47/)).toBeInTheDocument();
  });

  it('shows empty state when no completed executions', () => {
    renderWithProviders(<RecentResults executions={[]} />);
    expect(screen.getByText('No completed executions yet')).toBeInTheDocument();
  });
});
