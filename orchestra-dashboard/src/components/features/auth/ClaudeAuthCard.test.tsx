import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClaudeAuthCard } from './ClaudeAuthCard.tsx';
import type { AuthStatus, ClaudeLoginStatus } from '../../../lib/types.ts';

const baseAuth: AuthStatus = {
  github: { authenticated: false, username: null },
  claude: { authenticated: false },
};

const connectedAuth: AuthStatus = {
  github: { authenticated: false, username: null },
  claude: { authenticated: true, email: 'user@example.com' },
};

const connectedAuthNoEmail: AuthStatus = {
  github: { authenticated: false, username: null },
  claude: { authenticated: true },
};

describe('ClaudeAuthCard', () => {
  // ── Default (card) mode ─────────────────────────────────────────────

  describe('default mode', () => {
    it('renders card wrapper with heading', () => {
      render(
        <ClaudeAuthCard
          authStatus={baseAuth}
          claudeLoginSession={null}
          loading={false}
          claudeLoginInProgress={false}
          onLogin={vi.fn()}
          error={null}
        />,
      );
      expect(screen.getByRole('heading', { name: 'Claude Code' })).toBeInTheDocument();
      expect(screen.getByText('Claude Code CLI authentication status')).toBeInTheDocument();
    });

    it('shows Disconnected badge when not authenticated', () => {
      render(
        <ClaudeAuthCard
          authStatus={baseAuth}
          claudeLoginSession={null}
          loading={false}
          claudeLoginInProgress={false}
          onLogin={vi.fn()}
          error={null}
        />,
      );
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });

    it('shows Connected badge when authenticated', () => {
      render(
        <ClaudeAuthCard
          authStatus={connectedAuth}
          claudeLoginSession={null}
          loading={false}
          claudeLoginInProgress={false}
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
        <ClaudeAuthCard
          authStatus={baseAuth}
          claudeLoginSession={null}
          loading={false}
          claudeLoginInProgress={false}
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
      <ClaudeAuthCard
        authStatus={null}
        claudeLoginSession={null}
        loading={true}
        claudeLoginInProgress={false}
        onLogin={vi.fn()}
        error={null}
        compact
      />,
    );
    expect(screen.getByText('Checking status...')).toBeInTheDocument();
  });

  // ── Connected state ─────────────────────────────────────────────────

  it('shows email when authenticated with email', () => {
    render(
      <ClaudeAuthCard
        authStatus={connectedAuth}
        claudeLoginSession={null}
        loading={false}
        claudeLoginInProgress={false}
        onLogin={vi.fn()}
        error={null}
        compact
      />,
    );
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
  });

  it('shows generic message when authenticated without email', () => {
    render(
      <ClaudeAuthCard
        authStatus={connectedAuthNoEmail}
        claudeLoginSession={null}
        loading={false}
        claudeLoginInProgress={false}
        onLogin={vi.fn()}
        error={null}
        compact
      />,
    );
    expect(screen.getByText('Claude Code CLI is authenticated and ready.')).toBeInTheDocument();
  });

  // ── Login-in-progress state ─────────────────────────────────────────

  it('shows authorization link when login is in progress', () => {
    const session: ClaudeLoginStatus = {
      status: 'pending',
      authUrl: 'https://example.com/auth',
    };
    render(
      <ClaudeAuthCard
        authStatus={baseAuth}
        claudeLoginSession={session}
        loading={false}
        claudeLoginInProgress={true}
        onLogin={vi.fn()}
        error={null}
        compact
      />,
    );
    expect(screen.getByText('Open the link below to authorize Claude Code:')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /Open Authorization Page/i });
    expect(link).toHaveAttribute('href', 'https://example.com/auth');
    expect(link).toHaveAttribute('target', '_blank');
    expect(screen.getByText('Waiting for authorization...')).toBeInTheDocument();
  });

  // ── Default state with connect button ───────────────────────────────

  it('shows Connect Claude button when not authenticated', async () => {
    const onLogin = vi.fn();
    render(
      <ClaudeAuthCard
        authStatus={baseAuth}
        claudeLoginSession={null}
        loading={false}
        claudeLoginInProgress={false}
        onLogin={onLogin}
        error={null}
        compact
      />,
    );
    const button = screen.getByRole('button', { name: 'Connect Claude' });
    expect(button).toBeInTheDocument();
    await userEvent.click(button);
    expect(onLogin).toHaveBeenCalledOnce();
  });

  // ── Error state ─────────────────────────────────────────────────────

  it('shows error from prop', () => {
    render(
      <ClaudeAuthCard
        authStatus={baseAuth}
        claudeLoginSession={null}
        loading={false}
        claudeLoginInProgress={false}
        onLogin={vi.fn()}
        error="Something went wrong"
        compact
      />,
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('shows error from session', () => {
    const session: ClaudeLoginStatus = {
      status: 'error',
      error: 'CLI not installed',
    };
    render(
      <ClaudeAuthCard
        authStatus={baseAuth}
        claudeLoginSession={session}
        loading={false}
        claudeLoginInProgress={false}
        onLogin={vi.fn()}
        error={null}
        compact
      />,
    );
    expect(screen.getByText('CLI not installed')).toBeInTheDocument();
  });
});
