import { describe, it, expect } from 'vitest';
import { renderWithProviders, screen } from '../test/testUtils.tsx';
import { FindingsPage } from './FindingsPage.tsx';

describe('FindingsPage', () => {
  it('renders page title', () => {
    renderWithProviders(<FindingsPage />);
    expect(screen.getByText('Findings')).toBeInTheDocument();
  });

  it('shows total findings count', () => {
    renderWithProviders(<FindingsPage />);
    expect(screen.getByText('10 total findings')).toBeInTheDocument();
  });

  it('renders filters section', () => {
    renderWithProviders(<FindingsPage />);
    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  it('renders finding titles', () => {
    renderWithProviders(<FindingsPage />);
    expect(screen.getByText('SQL injection in user input handling')).toBeInTheDocument();
  });
});
