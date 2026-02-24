import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UpdateCard } from './UpdateCard.tsx';
import { triggerSystemUpdate } from '../../../lib/api.ts';

vi.mock('../../../lib/api.ts', () => ({
  triggerSystemUpdate: vi.fn(),
}));

const mockedTrigger = vi.mocked(triggerSystemUpdate);

describe('UpdateCard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Prevent window.location.reload from actually navigating
    Object.defineProperty(window, 'location', {
      value: { reload: vi.fn() },
      writable: true,
    });
  });

  it('renders card with heading and Update Now button', () => {
    render(<UpdateCard />);
    expect(
      screen.getByRole('heading', { name: 'System Update' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Update Now' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Pull the latest code and restart services'),
    ).toBeInTheDocument();
  });

  it('shows updating state with spinner when button is clicked', async () => {
    // Return a promise that never resolves so we stay in "updating" state
    mockedTrigger.mockReturnValue(new Promise(() => {}));

    render(<UpdateCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Update Now' }));

    await waitFor(() => {
      expect(screen.getByText('Pulling latest code...')).toBeInTheDocument();
    });
    // The Update Now button should no longer be visible
    expect(
      screen.queryByRole('button', { name: 'Update Now' }),
    ).not.toBeInTheDocument();
  });

  it('shows success state when update succeeds', async () => {
    mockedTrigger.mockResolvedValue({ status: 'ok' });

    render(<UpdateCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Update Now' }));

    await waitFor(() => {
      expect(
        screen.getByText('Update complete, reloading...'),
      ).toBeInTheDocument();
    });
  });

  it('shows error state when update fails', async () => {
    mockedTrigger.mockResolvedValue({
      status: 'error',
      message: 'git fetch failed',
    });

    render(<UpdateCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Update Now' }));

    await waitFor(() => {
      expect(screen.getByText('git fetch failed')).toBeInTheDocument();
    });
    // Should show the Try Again button in error state
    expect(
      screen.getByRole('button', { name: 'Try Again' }),
    ).toBeInTheDocument();
  });

  it('treats network errors as success', async () => {
    mockedTrigger.mockRejectedValue(new Error('Network error'));

    render(<UpdateCard />);
    fireEvent.click(screen.getByRole('button', { name: 'Update Now' }));

    await waitFor(() => {
      expect(
        screen.getByText('Update complete, reloading...'),
      ).toBeInTheDocument();
    });
  });
});
