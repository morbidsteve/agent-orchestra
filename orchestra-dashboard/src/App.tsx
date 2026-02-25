import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { OrchestraProvider } from './context/OrchestraContext.tsx';
import { SessionProvider } from './context/SessionContext.tsx';
import { SessionLayout, SessionWorkspace, RequireAuth } from './components/layout/index.ts';
import {
  ExecutionDetailPage,
  AgentsPage,
  FindingsPage,
  SettingsPage,
  SetupWizardPage,
} from './pages/index.ts';

export function App() {
  return (
    <BrowserRouter>
      <OrchestraProvider>
        <SessionProvider>
          <Routes>
            <Route path="/setup" element={<SetupWizardPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<SessionLayout />}>
                <Route path="/" element={<SessionWorkspace />} />
                <Route path="/executions/:id" element={<ExecutionDetailPage />} />
                <Route path="/agents" element={<AgentsPage />} />
                <Route path="/findings" element={<FindingsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/new" element={<Navigate to="/" replace />} />
              </Route>
            </Route>
          </Routes>
        </SessionProvider>
      </OrchestraProvider>
    </BrowserRouter>
  );
}
