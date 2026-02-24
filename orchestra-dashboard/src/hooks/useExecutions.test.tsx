import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OrchestraProvider } from '../context/OrchestraContext.tsx';
import { useExecutions } from './useExecutions';
import { mockState } from '../lib/mockData';
import type { ReactNode } from 'react';

function wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <OrchestraProvider initialState={mockState}>{children}</OrchestraProvider>
    </MemoryRouter>
  );
}

describe('useExecutions', () => {
  it('returns all executions', () => {
    const { result } = renderHook(() => useExecutions(), { wrapper });
    expect(result.current.executions).toHaveLength(4);
  });

  it('filters active executions', () => {
    const { result } = renderHook(() => useExecutions(), { wrapper });
    // exec-001 is running, exec-004 is queued
    expect(result.current.active.length).toBeGreaterThanOrEqual(2);
    result.current.active.forEach(e => {
      expect(['running', 'queued']).toContain(e.status);
    });
  });

  it('filters completed executions', () => {
    const { result } = renderHook(() => useExecutions(), { wrapper });
    result.current.completed.forEach(e => {
      expect(['completed', 'failed']).toContain(e.status);
    });
  });

  it('computes stats correctly', () => {
    const { result } = renderHook(() => useExecutions(), { wrapper });
    const { stats } = result.current;
    expect(stats.total).toBe(4);
    expect(stats.running).toBe(1);
    expect(stats.completed).toBe(1);
    expect(stats.failed).toBe(1);
    expect(stats.queued).toBe(1);
  });

  it('returns latest as an active execution when one exists', () => {
    const { result } = renderHook(() => useExecutions(), { wrapper });
    // With mock data, there are active executions (running/queued),
    // so latest should be one of them
    expect(result.current.latest).not.toBeNull();
    expect(['running', 'queued']).toContain(result.current.latest!.status);
  });
});
