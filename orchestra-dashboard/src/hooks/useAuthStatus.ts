import { useState, useEffect, useCallback, useRef } from 'react';
import type { AuthStatus, GitHubLoginResponse, GitHubLoginStatus } from '../lib/types.ts';
import { fetchAuthStatus, startGithubLogin, fetchGithubLoginStatus, githubLogout } from '../lib/api.ts';

interface UseAuthStatusResult {
  authStatus: AuthStatus | null;
  loginSession: GitHubLoginStatus | null;
  loading: boolean;
  loginInProgress: boolean;
  startLogin: () => Promise<GitHubLoginResponse | null>;
  logout: () => Promise<void>;
}

export function useAuthStatus(): UseAuthStatusResult {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [loginSession, setLoginSession] = useState<GitHubLoginStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginInProgress, setLoginInProgress] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Poll login status when login is in progress
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

  return { authStatus, loginSession, loading, loginInProgress, startLogin, logout };
}
