import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { OrchestraProvider } from './context/OrchestraContext.tsx';
import { ConversationProvider } from './context/ConversationContext.tsx';
import { AppLayout, RequireAuth } from './components/layout/index.ts';
import {
  ConsolePage,
  DashboardPage,
  ExecutionDetailPage,
  AgentOfficePage,
  AgentsPage,
  FindingsPage,
  SettingsPage,
  SetupWizardPage,
} from './pages/index.ts';

export function App() {
  return (
    <BrowserRouter>
      <OrchestraProvider>
        <ConversationProvider>
          <Routes>
            <Route path="/setup" element={<SetupWizardPage />} />
            <Route element={<RequireAuth />}>
              <Route element={<AppLayout />}>
                <Route path="/" element={<ConsolePage />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/office" element={<AgentOfficePage />} />
                <Route path="/executions/:id" element={<ExecutionDetailPage />} />
                <Route path="/agents" element={<AgentsPage />} />
                <Route path="/findings" element={<FindingsPage />} />
                <Route path="/new" element={<Navigate to="/" replace />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>
          </Routes>
        </ConversationProvider>
      </OrchestraProvider>
    </BrowserRouter>
  );
}
