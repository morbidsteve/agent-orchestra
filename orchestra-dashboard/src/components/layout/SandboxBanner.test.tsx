import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '../../test/testUtils.tsx';
import { SandboxBanner } from './SandboxBanner.tsx';

// Mock the api module
vi.mock('../../lib/api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api.ts')>();
  return {
    ...actual,
    fetchEnvironment: vi.fn(),
  };
});

import { fetchEnvironment } from '../../lib/api.ts';
const mockFetchEnvironment = vi.mocked(fetchEnvironment);

describe('SandboxBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing when sandboxed', async () => {
    mockFetchEnvironment.mockResolvedValue({
      sandboxed: true,
      container_type: 'devcontainer',
      override_active: false,
    });

    const { container } = renderWithProviders(<SandboxBanner />);
    await waitFor(() => {
      expect(mockFetchEnvironment).toHaveBeenCalledOnce();
    });
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it('renders blocked banner when not sandboxed', async () => {
    mockFetchEnvironment.mockResolvedValue({
      sandboxed: false,
      container_type: null,
      override_active: false,
    });

    renderWithProviders(<SandboxBanner />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('No container detected');
    expect(alert).toHaveTextContent('agent execution is disabled');
    // Should have a dismiss button (dashboard still works)
    expect(screen.getByLabelText('Dismiss warning')).toBeInTheDocument();
  });

  it('renders override banner when override active', async () => {
    mockFetchEnvironment.mockResolvedValue({
      sandboxed: false,
      container_type: null,
      override_active: true,
    });

    renderWithProviders(<SandboxBanner />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('unrestricted host filesystem access');
    expect(screen.getByLabelText('Dismiss warning')).toBeInTheDocument();
  });

  it('renders nothing on API error', async () => {
    mockFetchEnvironment.mockRejectedValue(new Error('Network error'));

    const { container } = renderWithProviders(<SandboxBanner />);
    await waitFor(() => {
      expect(mockFetchEnvironment).toHaveBeenCalledOnce();
    });
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });
});
