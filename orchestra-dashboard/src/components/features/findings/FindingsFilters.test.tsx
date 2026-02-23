import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FindingsFilters } from './FindingsFilters.tsx';

const defaultProps = {
  filters: { severity: null as null, type: null as null, status: null as null },
  setSeverity: vi.fn(),
  setType: vi.fn(),
  setStatus: vi.fn(),
  clearFilters: vi.fn(),
};

describe('FindingsFilters', () => {
  it('renders filter headings', () => {
    render(<FindingsFilters {...defaultProps} />);
    expect(screen.getByText('Severity')).toBeInTheDocument();
    expect(screen.getByText('Type')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });

  it('renders severity filter buttons', () => {
    render(<FindingsFilters {...defaultProps} />);
    expect(screen.getByRole('button', { name: 'critical' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'high' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'medium' })).toBeInTheDocument();
  });

  it('calls setSeverity when clicking severity filter', async () => {
    const setSeverity = vi.fn();
    render(<FindingsFilters {...defaultProps} setSeverity={setSeverity} />);
    await userEvent.click(screen.getByRole('button', { name: 'critical' }));
    expect(setSeverity).toHaveBeenCalledWith('critical');
  });

  it('shows clear button when filters are active', () => {
    render(<FindingsFilters {...defaultProps} filters={{ severity: 'critical', type: null, status: null }} />);
    expect(screen.getByText('Clear all')).toBeInTheDocument();
  });

  it('does not show clear button when no filters are active', () => {
    render(<FindingsFilters {...defaultProps} />);
    expect(screen.queryByText('Clear all')).not.toBeInTheDocument();
  });

  it('calls clearFilters when clicking clear all', async () => {
    const clearFilters = vi.fn();
    render(<FindingsFilters {...defaultProps} clearFilters={clearFilters} filters={{ severity: 'high', type: null, status: null }} />);
    await userEvent.click(screen.getByText('Clear all'));
    expect(clearFilters).toHaveBeenCalledOnce();
  });
});
