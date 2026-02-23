import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar.tsx';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-surface-900">
      <Sidebar />
      <main className="ml-60 min-h-screen">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
