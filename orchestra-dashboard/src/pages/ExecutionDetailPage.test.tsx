import { describe, it, expect } from 'vitest';
import { Routes, Route } from 'react-router-dom';
import { renderWithProviders, screen } from '../test/testUtils.tsx';
import { ExecutionDetailPage } from './ExecutionDetailPage.tsx';

describe('ExecutionDetailPage', () => {
  it('renders execution details when found', () => {
    renderWithProviders(
      <Routes>
        <Route path="/executions/:id" element={<ExecutionDetailPage />} />
      </Routes>,
      { initialEntries: ['/executions/exec-001'] },
    );
    expect(screen.getByText(/Execution/)).toBeInTheDocument();
  });

  it('shows not found for invalid execution', () => {
    renderWithProviders(
      <Routes>
        <Route path="/executions/:id" element={<ExecutionDetailPage />} />
      </Routes>,
      { initialEntries: ['/executions/exec-999'] },
    );
    expect(screen.getByText('Execution not found')).toBeInTheDocument();
  });
});
