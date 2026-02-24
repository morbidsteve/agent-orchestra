import { useState, useEffect, useCallback, useRef } from 'react';
import type { AuthStatus, GitHubLoginResponse, GitHubLoginStatus, ClaudeLoginResponse, ClaudeLoginStatus } from '../lib/types.ts';
import { fetchAuthStatus, startGithubLogin, fetchGithubLoginStatus, githubLogout, startClaudeLogin, fetchClaudeLoginStatus } from '../lib/api.ts';

interface UseAuthStatusResult {
  authStatus: AuthStatus | null;
  loginSession: GitHubLoginStatus | null;
  claudeLoginSession: ClaudeLoginStatus | null;
  loading: boolean;
  loginInProgress: boolean;
  claudeLoginInProgress: boolean;
  startLogin: () => Promise<GitHubLoginResponse | null>;
  startClaudeAuth: () => Promise<ClaudeLoginResponse | null>;
  logout: () => Promise<void>;
}

export function useAuthStatus(): UseAuthStatusResult {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [loginSession, setLoginSession] = useState<GitHubLoginStatus | null>(null);
  const [claudeLoginSession, setClaudeLoginSession] = useState<ClaudeLoginStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginInProgress, setLoginInProgress] = useState(false);
  const [claudeLoginInProgress, setClaudeLoginInProgress] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const claudePollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const status = await fetchAuthStatus();
      setAuthStatus(status);
    } catch {
      setAuthStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  // Poll GitHub login status when login is in progress
  useEffect(() => {
    if (!loginInProgress) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    pollRef.current = setInterval(async () => {
      try {
        const session = await fetchGithubLoginStatus();
        setLoginSession(session);

        if (session.status === 'authenticated' || session.status === 'error') {
          setLoginInProgress(false);
          // Refresh auth status
          void fetchStatus();
        }
      } catch {
        // Ignore poll errors
      }
    }, 2000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [loginInProgress, fetchStatus]);

  // Poll Claude login status when login is in progress
  useEffect(() => {
    if (!claudeLoginInProgress) {
      if (claudePollRef.current) {
        clearInterval(claudePollRef.current);
        claudePollRef.current = null;
      }
      return;
    }

    claudePollRef.current = setInterval(async () => {
      try {
        const session = await fetchClaudeLoginStatus();
        setClaudeLoginSession(session);

        if (session.status === 'authenticated' || session.status === 'error') {
          setClaudeLoginInProgress(false);
          // Refresh auth status
          void fetchStatus();
        }
      } catch {
        // Ignore poll errors
      }
    }, 2000);

    return () => {
      if (claudePollRef.current) {
        clearInterval(claudePollRef.current);
        claudePollRef.current = null;
      }
    };
  }, [claudeLoginInProgress, fetchStatus]);

  const startLogin = useCallback(async (): Promise<GitHubLoginResponse | null> => {
    try {
      const response = await startGithubLogin();
      setLoginSession({ status: 'pending', deviceCode: response.deviceCode });
      setLoginInProgress(true);
      return response;
    } catch {
      return null;
    }
  }, []);

  const startClaudeAuth = useCallback(async (): Promise<ClaudeLoginResponse | null> => {
    try {
      const response = await startClaudeLogin();
      setClaudeLoginSession({ status: 'pending', authUrl: response.authUrl });
      setClaudeLoginInProgress(true);
      return response;
    } catch {
      return null;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await githubLogout();
      setLoginSession(null);
      setLoginInProgress(false);
      void fetchStatus();
    } catch {
      // Ignore logout errors
    }
  }, [fetchStatus]);

  return {
    authStatus,
    loginSession,
    claudeLoginSession,
    loading,
    loginInProgress,
    claudeLoginInProgress,
    startLogin,
    startClaudeAuth,
    logout,
  };
}
