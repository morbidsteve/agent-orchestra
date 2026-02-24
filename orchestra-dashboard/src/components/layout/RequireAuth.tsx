import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useOrchestra } from '../../context/OrchestraContext.tsx';
import { LoadingScreen } from './LoadingScreen.tsx';

export function RequireAuth() {
  const { authStatus } = useOrchestra();
  const location = useLocation();

  if (authStatus === null) {
    return <LoadingScreen />;
  }

  if (!authStatus.github.authenticated || !authStatus.claude.authenticated) {
    return <Navigate to="/setup" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
