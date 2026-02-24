import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { RequireAuth } from './RequireAuth.tsx';

// Mock useOrchestra
const mockUseOrchestra = vi.fn();
vi.mock('../../context/OrchestraContext.tsx', () => ({
  useOrchestra: () => mockUseOrchestra(),
}));

function renderWithRouter(initialEntries: string[] = ['/protected']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route element={<RequireAuth />}>
          <Route path="/protected" element={<div>Protected Content</div>} />
        </Route>
        <Route path="/setup" element={<div>Setup Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

const baseMock = { refetchAuthStatus: vi.fn() };

describe('RequireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading screen when authStatus is null', () => {
    mockUseOrchestra.mockReturnValue({ ...baseMock, authStatus: null });
    renderWithRouter();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.queryByText('Setup Page')).not.toBeInTheDocument();
  });

  it('redirects to /setup when github is not authenticated', () => {
    mockUseOrchestra.mockReturnValue({
      ...baseMock,
      authStatus: {
        github: { authenticated: false, username: null },
        claude: { authenticated: true },
      },
    });
    renderWithRouter();
    expect(screen.getByText('Setup Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('redirects to /setup when claude is not authenticated', () => {
    mockUseOrchestra.mockReturnValue({
      ...baseMock,
      authStatus: {
        github: { authenticated: true, username: 'octocat' },
        claude: { authenticated: false },
      },
    });
    renderWithRouter();
    expect(screen.getByText('Setup Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('redirects to /setup when neither service is authenticated', () => {
    mockUseOrchestra.mockReturnValue({
      ...baseMock,
      authStatus: {
        github: { authenticated: false, username: null },
        claude: { authenticated: false },
      },
    });
    renderWithRouter();
    expect(screen.getByText('Setup Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders child route (Outlet) when both services are authenticated', () => {
    mockUseOrchestra.mockReturnValue({
      ...baseMock,
      authStatus: {
        github: { authenticated: true, username: 'octocat' },
        claude: { authenticated: true, email: 'user@example.com' },
      },
    });
    renderWithRouter();
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
    expect(screen.queryByText('Setup Page')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });
});
