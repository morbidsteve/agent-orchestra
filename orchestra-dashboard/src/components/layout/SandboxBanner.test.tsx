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

import { fetchEnvironment, type EnvironmentResponse } from '../../lib/api.ts';
const mockFetchEnvironment = vi.mocked(fetchEnvironment);

describe('SandboxBanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing in native mode', async () => {
    mockFetchEnvironment.mockResolvedValue({
      sandboxed: true,
      container_type: 'devcontainer',
      override_active: false,
      docker_available: false,
      execution_mode: 'native',
    });

    const { container } = renderWithProviders(<SandboxBanner />);
    await waitFor(() => {
      expect(mockFetchEnvironment).toHaveBeenCalledOnce();
    });
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('renders blue info banner in docker-wrap mode', async () => {
    mockFetchEnvironment.mockResolvedValue({
      sandboxed: false,
      container_type: null,
      override_active: false,
      docker_available: true,
      execution_mode: 'docker-wrap',
    });

    renderWithProviders(<SandboxBanner />);
    const banner = await screen.findByRole('status');
    expect(banner).toHaveTextContent('automatically containerized via Docker');
    expect(screen.getByLabelText('Dismiss info')).toBeInTheDocument();
  });

  it('renders amber warning in host-override mode', async () => {
    mockFetchEnvironment.mockResolvedValue({
      sandboxed: false,
      container_type: null,
      override_active: true,
      docker_available: false,
      execution_mode: 'host-override',
    });

    renderWithProviders(<SandboxBanner />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('unrestricted host filesystem access');
    expect(screen.getByLabelText('Dismiss warning')).toBeInTheDocument();
  });

  it('renders blocked banner when no Docker and no override', async () => {
    mockFetchEnvironment.mockResolvedValue({
      sandboxed: false,
      container_type: null,
      override_active: false,
      docker_available: false,
      execution_mode: 'blocked',
    });

    renderWithProviders(<SandboxBanner />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Docker is not available');
    expect(alert).toHaveTextContent('agent execution is disabled');
    expect(screen.getByLabelText('Dismiss warning')).toBeInTheDocument();
  });

  it('renders nothing on API error', async () => {
    mockFetchEnvironment.mockRejectedValue(new Error('Network error'));

    const { container } = renderWithProviders(<SandboxBanner />);
    await waitFor(() => {
      expect(mockFetchEnvironment).toHaveBeenCalledOnce();
    });
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
  });

  it('falls back to legacy fields when execution_mode is missing', async () => {
    mockFetchEnvironment.mockResolvedValue({
      sandboxed: true,
      container_type: 'devcontainer',
      override_active: false,
      docker_available: false,
      // Simulate backend returning empty string (not in union type)
      execution_mode: '' as unknown as EnvironmentResponse['execution_mode'],
    });

    const { container } = renderWithProviders(<SandboxBanner />);
    await waitFor(() => {
      expect(mockFetchEnvironment).toHaveBeenCalledOnce();
    });
    // Should fall back to 'native' since sandboxed=true
    expect(container.querySelector('[role="alert"]')).toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
  });
});
