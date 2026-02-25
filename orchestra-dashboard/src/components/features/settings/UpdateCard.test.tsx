import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UpdateCard } from './UpdateCard.tsx';
import { triggerSystemUpdate, fetchSystemTags } from '../../../lib/api.ts';

vi.mock('../../../lib/api.ts', () => ({
  triggerSystemUpdate: vi.fn(),
  fetchSystemTags: vi.fn(),
}));

const mockedFetchTags = vi.mocked(fetchSystemTags);
const mockedTrigger = vi.mocked(triggerSystemUpdate);

const SAMPLE_TAGS = [
  { name: 'v0.11.0', date: '2026-02-20' },
  { name: 'v0.10.0', date: '2026-02-10' },
  { name: 'v0.9.0', date: '2026-01-15' },
];

function tagsResponse(overrides: {
  tags?: typeof SAMPLE_TAGS;
  current_tag?: string | null;
  current_commit?: string;
} = {}) {
  return {
    tags: 'tags' in overrides ? overrides.tags! : SAMPLE_TAGS,
    current_tag: 'current_tag' in overrides ? overrides.current_tag : 'v0.11.0',
    current_commit: 'current_commit' in overrides ? overrides.current_commit! : 'abc1234def5678',
  };
}

describe('UpdateCard', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Prevent window.location.reload from actually navigating
    Object.defineProperty(window, 'location', {
      value: { reload: vi.fn() },
      writable: true,
    });
  });

  // ── 1. Loading state ──────────────────────────────────────────────────────

  it('shows loading state while tags are being fetched', () => {
    // fetchSystemTags returns a promise that never resolves
    mockedFetchTags.mockReturnValue(new Promise(() => {}));

    render(<UpdateCard />);

    expect(
      screen.getByRole('heading', { name: 'System Update' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Loading available versions...'),
    ).toBeInTheDocument();
  });

  // ── 2. Version switcher when tags load ────────────────────────────────────

  it('shows version switcher with dropdown when tags load', async () => {
    mockedFetchTags.mockResolvedValue(tagsResponse());

    render(<UpdateCard />);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    const select = screen.getByRole('combobox');
    const options = select.querySelectorAll('option');
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveTextContent('v0.11.0');
    expect(options[1]).toHaveTextContent('v0.10.0');
    expect(options[2]).toHaveTextContent('v0.9.0');
  });

  // ── 3. Displays current version label ─────────────────────────────────────

  it('displays current version when current_tag is set', async () => {
    mockedFetchTags.mockResolvedValue(tagsResponse({ current_tag: 'v0.11.0' }));

    render(<UpdateCard />);

    await waitFor(() => {
      expect(screen.getByText('Current Version:')).toBeInTheDocument();
    });
    expect(screen.getByText('v0.11.0')).toBeInTheDocument();
  });

  // ── 4. Displays untagged version ──────────────────────────────────────────

  it('displays commit hash with (untagged) when current_tag is null', async () => {
    mockedFetchTags.mockResolvedValue(
      tagsResponse({ current_tag: null, current_commit: 'deadbeef12345678' }),
    );

    render(<UpdateCard />);

    await waitFor(() => {
      expect(screen.getByText('Current Version:')).toBeInTheDocument();
    });
    expect(screen.getByText('deadbee (untagged)')).toBeInTheDocument();
  });

  // ── 5. Switch button disabled when current tag selected ───────────────────

  it('disables Switch Version button when current tag is selected', async () => {
    mockedFetchTags.mockResolvedValue(
      tagsResponse({ current_tag: 'v0.11.0' }),
    );

    render(<UpdateCard />);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    // Default selection is the current tag, so switch button should be disabled
    const switchBtn = screen.getByRole('button', { name: 'Switch Version' });
    expect(switchBtn).toBeDisabled();
  });

  // ── 6. Switch button enabled when different tag selected ──────────────────

  it('enables Switch button when a different tag is selected', async () => {
    mockedFetchTags.mockResolvedValue(
      tagsResponse({ current_tag: 'v0.11.0' }),
    );

    render(<UpdateCard />);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'v0.10.0' },
    });

    const switchBtn = screen.getByRole('button', {
      name: 'Switch to v0.10.0',
    });
    expect(switchBtn).toBeEnabled();
  });

  // ── 7. Switching version calls API with tag ───────────────────────────────

  it('calls triggerSystemUpdate with the selected tag on switch', async () => {
    mockedFetchTags.mockResolvedValue(
      tagsResponse({ current_tag: 'v0.11.0' }),
    );
    mockedTrigger.mockResolvedValue({ status: 'ok' });

    render(<UpdateCard />);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'v0.10.0' },
    });

    fireEvent.click(
      screen.getByRole('button', { name: 'Switch to v0.10.0' }),
    );

    await waitFor(() => {
      expect(mockedTrigger).toHaveBeenCalledWith('v0.10.0');
    });
  });

  // ── 8. Update to Latest calls API without tag ─────────────────────────────

  it('calls triggerSystemUpdate with no arguments for Update to Latest', async () => {
    mockedFetchTags.mockResolvedValue(tagsResponse());
    mockedTrigger.mockResolvedValue({ status: 'ok' });

    render(<UpdateCard />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Update to Latest/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', { name: /Update to Latest/i }),
    );

    await waitFor(() => {
      expect(mockedTrigger).toHaveBeenCalledWith();
    });
  });

  // ── 9. Falls back to Update Now when tags fail to load ────────────────────

  it('falls back to Update Now button when fetchSystemTags rejects', async () => {
    mockedFetchTags.mockRejectedValue(new Error('Network error'));

    render(<UpdateCard />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Update Now' }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Could not load version tags/),
    ).toBeInTheDocument();
    // No dropdown should be present
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  // ── 10. Falls back to Update Now when no tags exist ───────────────────────

  it('falls back to Update Now button when tags array is empty', async () => {
    mockedFetchTags.mockResolvedValue(
      tagsResponse({ tags: [], current_tag: null }),
    );

    render(<UpdateCard />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Update Now' }),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText(/No tagged versions found/),
    ).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  // ── 11. Shows success state on update ─────────────────────────────────────

  it('shows success state after a successful version switch', async () => {
    mockedFetchTags.mockResolvedValue(
      tagsResponse({ current_tag: 'v0.11.0' }),
    );
    mockedTrigger.mockResolvedValue({ status: 'ok' });

    render(<UpdateCard />);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'v0.10.0' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Switch to v0.10.0' }),
    );

    await waitFor(() => {
      expect(
        screen.getByText('Update complete, reloading...'),
      ).toBeInTheDocument();
    });
  });

  it('shows success state after Update to Latest succeeds', async () => {
    mockedFetchTags.mockResolvedValue(tagsResponse());
    mockedTrigger.mockResolvedValue({ status: 'ok' });

    render(<UpdateCard />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Update to Latest/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', { name: /Update to Latest/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText('Update complete, reloading...'),
      ).toBeInTheDocument();
    });
  });

  it('shows success state in fallback mode after Update Now succeeds', async () => {
    mockedFetchTags.mockRejectedValue(new Error('fail'));
    mockedTrigger.mockResolvedValue({ status: 'ok' });

    render(<UpdateCard />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Update Now' }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Update Now' }));

    await waitFor(() => {
      expect(
        screen.getByText('Update complete, reloading...'),
      ).toBeInTheDocument();
    });
  });

  // ── 12. Shows error state on failure ──────────────────────────────────────

  it('shows error message and Dismiss button when version switch fails', async () => {
    mockedFetchTags.mockResolvedValue(
      tagsResponse({ current_tag: 'v0.11.0' }),
    );
    mockedTrigger.mockResolvedValue({
      status: 'error',
      message: 'Checkout failed',
    });

    render(<UpdateCard />);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'v0.10.0' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Switch to v0.10.0' }),
    );

    await waitFor(() => {
      expect(screen.getByText('Checkout failed')).toBeInTheDocument();
    });
    expect(
      screen.getByRole('button', { name: 'Dismiss' }),
    ).toBeInTheDocument();
  });

  it('shows error with Try Again in fallback mode when update fails', async () => {
    mockedFetchTags.mockRejectedValue(new Error('fail'));
    mockedTrigger.mockResolvedValue({
      status: 'error',
      message: 'git fetch failed',
    });

    render(<UpdateCard />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Update Now' }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Update Now' }));

    await waitFor(() => {
      expect(screen.getByText('git fetch failed')).toBeInTheDocument();
    });
    expect(
      screen.getByRole('button', { name: 'Try Again' }),
    ).toBeInTheDocument();
  });

  // ── 13. Treats network errors as success ──────────────────────────────────

  it('treats network errors as success during version switch', async () => {
    mockedFetchTags.mockResolvedValue(
      tagsResponse({ current_tag: 'v0.11.0' }),
    );
    mockedTrigger.mockRejectedValue(new Error('Network error'));

    render(<UpdateCard />);

    await waitFor(() => {
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'v0.10.0' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Switch to v0.10.0' }),
    );

    await waitFor(() => {
      expect(
        screen.getByText('Update complete, reloading...'),
      ).toBeInTheDocument();
    });
  });

  it('treats network errors as success during Update to Latest', async () => {
    mockedFetchTags.mockResolvedValue(tagsResponse());
    mockedTrigger.mockRejectedValue(new Error('Network error'));

    render(<UpdateCard />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Update to Latest/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('button', { name: /Update to Latest/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText('Update complete, reloading...'),
      ).toBeInTheDocument();
    });
  });

  it('treats network errors as success in fallback mode', async () => {
    mockedFetchTags.mockRejectedValue(new Error('fail'));
    mockedTrigger.mockRejectedValue(new Error('Network error'));

    render(<UpdateCard />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: 'Update Now' }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Update Now' }));

    await waitFor(() => {
      expect(
        screen.getByText('Update complete, reloading...'),
      ).toBeInTheDocument();
    });
  });
});
