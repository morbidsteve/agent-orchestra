import { render } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OrchestraProvider } from '../context/OrchestraContext';
import type { OrchestraState } from '../lib/types';
import { mockState } from '../lib/mockData';
import type { ReactElement } from 'react';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialState?: OrchestraState;
  initialEntries?: string[];
}

export function renderWithProviders(
  ui: ReactElement,
  { initialState = mockState, initialEntries = ['/'], ...options }: CustomRenderOptions = {},
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <MemoryRouter initialEntries={initialEntries}>
        <OrchestraProvider initialState={initialState}>
          {children}
        </OrchestraProvider>
      </MemoryRouter>
    );
  }

  return render(ui, { wrapper: Wrapper, ...options });
}

export { default as userEvent } from '@testing-library/user-event';
export { screen, within, waitFor } from '@testing-library/react';
