import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OrchestraProvider } from '../context/OrchestraContext.tsx';
import { useFindings } from './useFindings';
import { mockState } from '../lib/mockData';
import type { ReactNode } from 'react';

function wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <OrchestraProvider initialState={mockState}>{children}</OrchestraProvider>
    </MemoryRouter>
  );
}

describe('useFindings', () => {
  it('returns all findings by default', () => {
    const { result } = renderHook(() => useFindings(), { wrapper });
    expect(result.current.findings).toHaveLength(10);
  });

  it('filters by severity', () => {
    const { result } = renderHook(() => useFindings(), { wrapper });
    act(() => {
      result.current.setSeverity('critical');
    });
    expect(result.current.findings.every(f => f.severity === 'critical')).toBe(true);
    expect(result.current.findings.length).toBeGreaterThan(0);
  });

  it('filters by type', () => {
    const { result } = renderHook(() => useFindings(), { wrapper });
    act(() => {
      result.current.setType('security');
    });
    expect(result.current.findings.every(f => f.type === 'security')).toBe(true);
  });

  it('filters by status', () => {
    const { result } = renderHook(() => useFindings(), { wrapper });
    act(() => {
      result.current.setStatus('open');
    });
    expect(result.current.findings.every(f => f.status === 'open')).toBe(true);
  });

  it('clears filters', () => {
    const { result } = renderHook(() => useFindings(), { wrapper });
    act(() => {
      result.current.setSeverity('critical');
    });
    const filteredCount = result.current.findings.length;
    act(() => {
      result.current.clearFilters();
    });
    expect(result.current.findings.length).toBeGreaterThan(filteredCount);
  });

  it('computes stats', () => {
    const { result } = renderHook(() => useFindings(), { wrapper });
    expect(result.current.stats.total).toBe(10);
    expect(result.current.stats.open).toBeGreaterThan(0);
    expect(result.current.stats.critical).toBeGreaterThan(0);
  });
});
