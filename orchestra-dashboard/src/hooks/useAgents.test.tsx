import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OrchestraProvider } from '../context/OrchestraContext.tsx';
import { useAgents } from './useAgents';
import { mockState } from '../lib/mockData';
import type { ReactNode } from 'react';

function wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <OrchestraProvider initialState={mockState}>{children}</OrchestraProvider>
    </MemoryRouter>
  );
}

describe('useAgents', () => {
  it('returns all agents', () => {
    const { result } = renderHook(() => useAgents(), { wrapper });
    expect(result.current.agents).toHaveLength(8);
  });

  it('counts busy agents', () => {
    const { result } = renderHook(() => useAgents(), { wrapper });
    // developer and tester are busy
    expect(result.current.busyCount).toBe(2);
  });

  it('counts online agents', () => {
    const { result } = renderHook(() => useAgents(), { wrapper });
    // business-dev is offline, rest are online
    expect(result.current.onlineCount).toBe(7);
  });
});
