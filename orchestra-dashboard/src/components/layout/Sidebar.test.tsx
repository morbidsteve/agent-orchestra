import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../../test/testUtils.tsx';
import { Sidebar } from './Sidebar.tsx';

describe('Sidebar', () => {
  it('renders logo text', () => {
    renderWithProviders(<Sidebar />);
    expect(screen.getByText('Agent Orchestra')).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    renderWithProviders(<Sidebar />);
    expect(screen.getByRole('link', { name: /Dashboard/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /New Execution/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Agents/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Findings/ })).toBeInTheDocument();
  });

  it('renders agent status section', () => {
    renderWithProviders(<Sidebar />);
    const agentsTexts = screen.getAllByText('Agents');
    expect(agentsTexts.length).toBeGreaterThanOrEqual(2); // nav link + section heading
    expect(screen.getByText('Developer (Primary)')).toBeInTheDocument();
  });
});
