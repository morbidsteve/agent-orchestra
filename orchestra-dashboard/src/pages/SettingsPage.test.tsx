import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '../test/testUtils.tsx';
import { SettingsPage } from './SettingsPage.tsx';

// Mock the useAuthStatus hook
vi.mock('../hooks/useAuthStatus.ts', () => ({
  useAuthStatus: vi.fn(),
}));

import { useAuthStatus } from '../hooks/useAuthStatus.ts';

const mockUseAuthStatus = vi.mocked(useAuthStatus);

const defaultHookResult = {
  authStatus: null,
  loginSession: null,
  claudeLoginSession: null,
  loading: false,
  loginInProgress: false,
  claudeLoginInProgress: false,
  startLogin: vi.fn().mockResolvedValue(null),
  startClaudeAuth: vi.fn().mockResolvedValue(null),
  submitClaudeCode: vi.fn().mockResolvedValue(false),
  logout: vi.fn().mockResolvedValue(undefined),
};

beforeEach(() => {
  mockUseAuthStatus.mockReturnValue(defaultHookResult);
});

describe('SettingsPage', () => {
  it('renders page title', () => {
    renderWithProviders(<SettingsPage />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('renders GitHub and Claude Code section headings', () => {
    renderWithProviders(<SettingsPage />);
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText('Claude Code')).toBeInTheDocument();
  });

  it('shows disconnected state when not authenticated', () => {
    mockUseAuthStatus.mockReturnValue({
      ...defaultHookResult,
      authStatus: {
        github: { authenticated: false, username: null },
        claude: { authenticated: false },
      },
    });
    renderWithProviders(<SettingsPage />);
    const badges = screen.getAllByText('Disconnected');
    expect(badges).toHaveLength(2);
    expect(screen.getByText('Connect GitHub')).toBeInTheDocument();
    expect(screen.getByText('Connect Claude')).toBeInTheDocument();
  });

  it('shows connected state with username when GitHub is authenticated', () => {
    mockUseAuthStatus.mockReturnValue({
      ...defaultHookResult,
      authStatus: {
        github: { authenticated: true, username: 'octocat' },
        claude: { authenticated: false },
      },
    });
    renderWithProviders(<SettingsPage />);
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByText('octocat')).toBeInTheDocument();
    expect(screen.getByText('Disconnect')).toBeInTheDocument();
  });

  it('shows Claude Code connected state', () => {
    mockUseAuthStatus.mockReturnValue({
      ...defaultHookResult,
      authStatus: {
        github: { authenticated: false, username: null },
        claude: { authenticated: true },
      },
    });
    renderWithProviders(<SettingsPage />);
    expect(screen.getByText('Claude Code CLI is authenticated and ready.')).toBeInTheDocument();
  });

  it('shows device code during login flow', () => {
    mockUseAuthStatus.mockReturnValue({
      ...defaultHookResult,
      authStatus: {
        github: { authenticated: false, username: null },
        claude: { authenticated: false },
      },
      loginInProgress: true,
      loginSession: { status: 'pending', deviceCode: 'ABCD-1234' },
    });
    renderWithProviders(<SettingsPage />);
    expect(screen.getByText('ABCD-1234')).toBeInTheDocument();
    expect(screen.getByText('Open GitHub')).toBeInTheDocument();
    expect(screen.getByText('Waiting for authorization...')).toBeInTheDocument();
  });

  it('shows Claude auth URL during login flow', () => {
    mockUseAuthStatus.mockReturnValue({
      ...defaultHookResult,
      authStatus: {
        github: { authenticated: false, username: null },
        claude: { authenticated: false },
      },
      claudeLoginInProgress: true,
      claudeLoginSession: { status: 'pending', authUrl: 'https://console.anthropic.com/auth' },
    });
    renderWithProviders(<SettingsPage />);
    expect(screen.getByText('Open Authorization Page')).toBeInTheDocument();
    expect(screen.getByText(/paste it below/)).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockUseAuthStatus.mockReturnValue({
      ...defaultHookResult,
      loading: true,
    });
    renderWithProviders(<SettingsPage />);
    const loadingTexts = screen.getAllByText('Checking status...');
    expect(loadingTexts).toHaveLength(2);
  });
});
