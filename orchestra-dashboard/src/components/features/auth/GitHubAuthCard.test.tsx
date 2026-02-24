import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GitHubAuthCard } from './GitHubAuthCard.tsx';
import type { AuthStatus, GitHubLoginStatus } from '../../../lib/types.ts';

const baseAuth: AuthStatus = {
  github: { authenticated: false, username: null },
  claude: { authenticated: false },
};

const connectedAuth: AuthStatus = {
  github: { authenticated: true, username: 'octocat' },
  claude: { authenticated: false },
};

describe('GitHubAuthCard', () => {
  // ── Default (card) mode ─────────────────────────────────────────────

  describe('default mode', () => {
    it('renders card wrapper with heading', () => {
      render(
        <GitHubAuthCard
          authStatus={baseAuth}
          loginSession={null}
          loading={false}
          loginInProgress={false}
          onLogin={vi.fn()}
          error={null}
        />,
      );
      expect(screen.getByRole('heading', { name: 'GitHub' })).toBeInTheDocument();
      expect(screen.getByText('Connect your GitHub account for repository access')).toBeInTheDocument();
    });

    it('shows Disconnected badge when not authenticated', () => {
      render(
        <GitHubAuthCard
          authStatus={baseAuth}
          loginSession={null}
          loading={false}
          loginInProgress={false}
          onLogin={vi.fn()}
          error={null}
        />,
      );
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });

    it('shows Connected badge when authenticated', () => {
      render(
        <GitHubAuthCard
          authStatus={connectedAuth}
          loginSession={null}
          loading={false}
          loginInProgress={false}
          onLogin={vi.fn()}
          error={null}
        />,
      );
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });

  // ── Compact mode ────────────────────────────────────────────────────

  describe('compact mode', () => {
    it('does not render card wrapper or heading', () => {
      render(
        <GitHubAuthCard
          authStatus={baseAuth}
          loginSession={null}
          loading={false}
          loginInProgress={false}
          onLogin={vi.fn()}
          error={null}
          compact
        />,
      );
      expect(screen.queryByRole('heading')).not.toBeInTheDocument();
      expect(screen.queryByText('Disconnected')).not.toBeInTheDocument();
    });
  });

  // ── Loading state ───────────────────────────────────────────────────

  it('shows loading spinner when loading', () => {
    render(
      <GitHubAuthCard
        authStatus={null}
        loginSession={null}
        loading={true}
        loginInProgress={false}
        onLogin={vi.fn()}
        error={null}
        compact
      />,
    );
    expect(screen.getByText('Checking status...')).toBeInTheDocument();
  });

  // ── Connected state ─────────────────────────────────────────────────

  it('shows username when authenticated', () => {
    render(
      <GitHubAuthCard
        authStatus={connectedAuth}
        loginSession={null}
        loading={false}
        loginInProgress={false}
        onLogin={vi.fn()}
        error={null}
        compact
      />,
    );
    expect(screen.getByText('octocat')).toBeInTheDocument();
  });

  it('shows disconnect button when onLogout is provided and authenticated', async () => {
    const onLogout = vi.fn();
    render(
      <GitHubAuthCard
        authStatus={connectedAuth}
        loginSession={null}
        loading={false}
        loginInProgress={false}
        onLogin={vi.fn()}
        onLogout={onLogout}
        error={null}
        compact
      />,
    );
    const disconnectBtn = screen.getByRole('button', { name: 'Disconnect' });
    expect(disconnectBtn).toBeInTheDocument();
    await userEvent.click(disconnectBtn);
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it('does not show disconnect button when onLogout is not provided', () => {
    render(
      <GitHubAuthCard
        authStatus={connectedAuth}
        loginSession={null}
        loading={false}
        loginInProgress={false}
        onLogin={vi.fn()}
        error={null}
        compact
      />,
    );
    expect(screen.queryByRole('button', { name: 'Disconnect' })).not.toBeInTheDocument();
  });

  // ── Login-in-progress state ─────────────────────────────────────────

  it('shows device code when login is in progress', () => {
    const session: GitHubLoginStatus = {
      status: 'pending',
      deviceCode: 'ABCD-1234',
    };
    render(
      <GitHubAuthCard
        authStatus={baseAuth}
        loginSession={session}
        loading={false}
        loginInProgress={true}
        onLogin={vi.fn()}
        error={null}
        compact
      />,
    );
    expect(screen.getByText('Enter this code on GitHub to complete authentication:')).toBeInTheDocument();
    expect(screen.getByText('ABCD-1234')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Open GitHub/i });
    expect(link).toHaveAttribute('href', 'https://github.com/login/device');
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.getByText('Waiting for authorization...')).toBeInTheDocument();
  });

  it('shows copy button for device code', () => {
    const session: GitHubLoginStatus = {
      status: 'pending',
      deviceCode: 'ABCD-1234',
    };
    render(
      <GitHubAuthCard
        authStatus={baseAuth}
        loginSession={session}
        loading={false}
        loginInProgress={true}
        onLogin={vi.fn()}
        error={null}
        compact
      />,
    );
    const copyButton = screen.getByTitle('Copy code');
    expect(copyButton).toBeInTheDocument();
  });

  // ── Default state with connect button ───────────────────────────────

  it('shows Connect GitHub button when not authenticated', async () => {
    const onLogin = vi.fn();
    render(
      <GitHubAuthCard
        authStatus={baseAuth}
        loginSession={null}
        loading={false}
        loginInProgress={false}
        onLogin={onLogin}
        error={null}
        compact
      />,
    );
    const button = screen.getByRole('button', { name: 'Connect GitHub' });
    expect(button).toBeInTheDocument();
    await userEvent.click(button);
    expect(onLogin).toHaveBeenCalledOnce();
  });

  // ── Error state ─────────────────────────────────────────────────────

  it('shows error from prop', () => {
    render(
      <GitHubAuthCard
        authStatus={baseAuth}
        loginSession={null}
        loading={false}
        loginInProgress={false}
        onLogin={vi.fn()}
        error="Auth failed"
        compact
      />,
    );
    expect(screen.getByText('Auth failed')).toBeInTheDocument();
  });

  it('shows error from session', () => {
    const session: GitHubLoginStatus = {
      status: 'error',
      error: 'Token expired',
    };
    render(
      <GitHubAuthCard
        authStatus={baseAuth}
        loginSession={session}
        loading={false}
        loginInProgress={false}
        onLogin={vi.fn()}
        error={null}
        compact
      />,
    );
    expect(screen.getByText('Token expired')).toBeInTheDocument();
  });
});
