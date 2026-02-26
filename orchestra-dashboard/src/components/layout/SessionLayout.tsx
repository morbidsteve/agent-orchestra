import { Outlet, useLocation } from 'react-router-dom';
import { TopBar } from './TopBar.tsx';
import { SessionSubNav } from './SessionSubNav.tsx';
import { SandboxBanner } from './SandboxBanner.tsx';

export function SessionLayout() {
  const location = useLocation();
  const isSessionRoute = location.pathname === '/';

  return (
    <div className="min-h-screen bg-surface-900">
      <TopBar />
      {isSessionRoute && <SessionSubNav />}
      <main className={isSessionRoute ? 'pt-[5.5rem]' : 'pt-12'}>
        <SandboxBanner />
        <div className={isSessionRoute ? 'h-[calc(100vh-5.5rem)]' : 'p-6'}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
