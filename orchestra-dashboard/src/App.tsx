import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { OrchestraProvider } from './context/OrchestraContext.tsx';
import { AppLayout } from './components/layout/index.ts';
import {
  DashboardPage,
  ExecutionDetailPage,
  AgentsPage,
  FindingsPage,
  NewExecutionPage,
} from './pages/index.ts';

export function App() {
  return (
    <BrowserRouter>
      <OrchestraProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/executions/:id" element={<ExecutionDetailPage />} />
            <Route path="/agents" element={<AgentsPage />} />
            <Route path="/findings" element={<FindingsPage />} />
            <Route path="/new" element={<NewExecutionPage />} />
          </Route>
        </Routes>
      </OrchestraProvider>
    </BrowserRouter>
  );
}
