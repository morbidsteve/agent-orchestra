import { useEffect } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useOrchestra } from '../../context/OrchestraContext.tsx';
import { LoadingScreen } from './LoadingScreen.tsx';

export function RequireAuth() {
  const { authStatus, refetchAuthStatus } = useOrchestra();
  const location = useLocation();

  // Force a fresh auth check every time this component mounts
  // (e.g. after the setup wizard completes and navigates here).
  useEffect(() => {
    refetchAuthStatus();
  }, [refetchAuthStatus]);

  if (authStatus === null) {
    return <LoadingScreen />;
  }

  if (!authStatus.github.authenticated || !authStatus.claude.authenticated) {
    return <Navigate to="/setup" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
