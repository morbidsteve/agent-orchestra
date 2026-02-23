import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OrchestraProvider, useOrchestra } from './OrchestraContext.tsx';
import { mockState } from '../lib/mockData';
import type { ReactNode } from 'react';

function wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <OrchestraProvider initialState={mockState}>{children}</OrchestraProvider>
    </MemoryRouter>
  );
}

describe('OrchestraContext', () => {
  it('provides initial state', () => {
    const { result } = renderHook(() => useOrchestra(), { wrapper });
    expect(result.current.executions).toHaveLength(4);
    expect(result.current.agents).toHaveLength(5);
    expect(result.current.findings).toHaveLength(10);
    expect(result.current.workflows).toHaveLength(5);
  });

  it('throws when used outside provider', () => {
    expect(() => {
      renderHook(() => useOrchestra());
    }).toThrow('useOrchestra must be used within an OrchestraProvider');
  });

  it('startExecution returns a new execution id', async () => {
    const { result } = renderHook(() => useOrchestra(), { wrapper });
    let id: string = '';
    await act(async () => {
      id = await result.current.startExecution('full-pipeline', 'Test task', 'claude-opus-4-6', 'src/', { type: 'local', path: '/tmp/test' });
    });
    expect(id).toBe('exec-005');
  });

  it('exposes isLive as false when using initialState', () => {
    const { result } = renderHook(() => useOrchestra(), { wrapper });
    expect(result.current.isLive).toBe(false);
  });

  it('exposes refetch function', () => {
    const { result } = renderHook(() => useOrchestra(), { wrapper });
    expect(typeof result.current.refetch).toBe('function');
  });
});
