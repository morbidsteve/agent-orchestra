import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SetupWizardPage } from './SetupWizardPage.tsx';

// Mock useAuthStatus
const mockUseAuthStatus = vi.fn();
vi.mock('../hooks/useAuthStatus.ts', () => ({
  useAuthStatus: () => mockUseAuthStatus(),
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/setup']}>
      <SetupWizardPage />
    </MemoryRouter>,
  );
}

const defaultHookReturn = {
  authStatus: null,
  loginSession: null,
  claudeLoginSession: null,
  loading: false,
  loginInProgress: false,
  claudeLoginInProgress: false,
  startLogin: vi.fn(),
  startClaudeAuth: vi.fn(),
  submitClaudeCode: vi.fn().mockResolvedValue(false),
  logout: vi.fn(),
};

describe('SetupWizardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page title and welcome message', () => {
    mockUseAuthStatus.mockReturnValue(defaultHookReturn);
    renderPage();
    expect(screen.getByText('Agent Orchestra')).toBeInTheDocument();
    expect(screen.getByText(/Welcome/)).toBeInTheDocument();
  });

  it('renders step indicator with both steps', () => {
    mockUseAuthStatus.mockReturnValue(defaultHookReturn);
    renderPage();
    expect(screen.getByText('Claude')).toBeInTheDocument();
    expect(screen.getByText('GitHub')).toBeInTheDocument();
  });

  // ── Step 0: Claude step ─────────────────────────────────────────────

  it('shows Claude step first when neither service is authenticated', () => {
    mockUseAuthStatus.mockReturnValue({
      ...defaultHookReturn,
      authStatus: {
        github: { authenticated: false, username: null },
        claude: { authenticated: false },
      },
    });
    renderPage();
    expect(screen.getByRole('heading', { name: 'Connect Claude Code' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect Claude' })).toBeInTheDocument();
  });

  it('shows Claude step when authStatus is null (initial load)', () => {
    mockUseAuthStatus.mockReturnValue(defaultHookReturn);
    renderPage();
    expect(screen.getByRole('heading', { name: 'Connect Claude Code' })).toBeInTheDocument();
  });

  // ── Step 1: GitHub step ─────────────────────────────────────────────

  it('shows GitHub step when Claude is authenticated but GitHub is not', () => {
    mockUseAuthStatus.mockReturnValue({
      ...defaultHookReturn,
      authStatus: {
        github: { authenticated: false, username: null },
        claude: { authenticated: true, email: 'user@example.com' },
      },
    });
    renderPage();
    expect(screen.getByRole('heading', { name: 'Connect GitHub' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Connect GitHub' })).toBeInTheDocument();
    // Claude step heading should NOT be visible
    expect(screen.queryByRole('heading', { name: 'Connect Claude Code' })).not.toBeInTheDocument();
  });

  // ── Step 2: Completion ──────────────────────────────────────────────

  it('shows completion step when both services are authenticated', () => {
    mockUseAuthStatus.mockReturnValue({
      ...defaultHookReturn,
      authStatus: {
        github: { authenticated: true, username: 'octocat' },
        claude: { authenticated: true, email: 'user@example.com' },
      },
    });
    renderPage();
    expect(screen.getByText("You're all set!")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Console' })).toBeInTheDocument();
  });

  it('shows authenticated user details on completion step', () => {
    mockUseAuthStatus.mockReturnValue({
      ...defaultHookReturn,
      authStatus: {
        github: { authenticated: true, username: 'octocat' },
        claude: { authenticated: true, email: 'user@example.com' },
      },
    });
    renderPage();
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
    expect(screen.getByText('octocat')).toBeInTheDocument();
  });

  it('shows generic Claude text on completion when no email available', () => {
    mockUseAuthStatus.mockReturnValue({
      ...defaultHookReturn,
      authStatus: {
        github: { authenticated: true, username: 'octocat' },
        claude: { authenticated: true },
      },
    });
    renderPage();
    expect(screen.getByText('Authenticated')).toBeInTheDocument();
  });
});
