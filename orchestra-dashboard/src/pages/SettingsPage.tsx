import { useState } from 'react';
import { useAuthStatus } from '../hooks/useAuthStatus.ts';
import { GitHubAuthCard } from '../components/features/auth/GitHubAuthCard.tsx';
import { ClaudeAuthCard } from '../components/features/auth/ClaudeAuthCard.tsx';

export function SettingsPage() {
  const {
    authStatus,
    loginSession,
    claudeLoginSession,
    loading,
    loginInProgress,
    claudeLoginInProgress,
    startLogin,
    startClaudeAuth,
    logout,
  } = useAuthStatus();
  const [githubError, setGithubError] = useState<string | null>(null);
  const [claudeError, setClaudeError] = useState<string | null>(null);

  const handleGithubLogin = async () => {
    setGithubError(null);
    const response = await startLogin();
    if (!response || response.status === 'error') {
      setGithubError('Failed to start GitHub login. Is the gh CLI installed?');
    }
  };

  const handleClaudeLogin = async () => {
    setClaudeError(null);
    const response = await startClaudeAuth();
    if (!response) {
      setClaudeError('Failed to start Claude login. Is the Claude CLI installed?');
    } else if (response.status === 'already_authenticated') {
      // Already authenticated — just refresh auth status
      // (the hook's polling will pick it up)
    } else if (response.status === 'error') {
      setClaudeError('Failed to start Claude login. Is the Claude CLI installed?');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">Settings</h1>

      {/* GitHub Integration */}
      <GitHubAuthCard
        authStatus={authStatus}
        loginSession={loginSession}
        loading={loading}
        loginInProgress={loginInProgress}
        onLogin={() => void handleGithubLogin()}
        onLogout={() => void logout()}
        error={githubError}
      />

      {/* Claude Code Integration */}
      <ClaudeAuthCard
        authStatus={authStatus}
        claudeLoginSession={claudeLoginSession}
        loading={loading}
        claudeLoginInProgress={claudeLoginInProgress}
        onLogin={() => void handleClaudeLogin()}
        error={claudeError}
      />
    </div>
  );
}
