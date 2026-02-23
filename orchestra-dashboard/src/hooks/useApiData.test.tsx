import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useApiData } from './useApiData.ts';

describe('useApiData', () => {
  it('returns fallback data initially', () => {
    const fetcher = vi.fn(() => new Promise<string[]>(() => {}));
    const { result } = renderHook(() => useApiData(fetcher, ['fallback']));

    expect(result.current.data).toEqual(['fallback']);
    expect(result.current.loading).toBe(true);
    expect(result.current.isLive).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('returns API data on success', async () => {
    const fetcher = vi.fn(() => Promise.resolve(['live-data']));
    const { result } = renderHook(() => useApiData(fetcher, ['fallback']));

    await waitFor(() => expect(result.current.isLive).toBe(true));

    expect(result.current.data).toEqual(['live-data']);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('falls back to fallback on error', async () => {
    const fetcher = vi.fn(() => Promise.reject(new Error('fail')));
    const { result } = renderHook(() => useApiData(fetcher, ['fallback']));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isLive).toBe(false);
    expect(result.current.data).toEqual(['fallback']);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('fail');
  });

  it('wraps non-Error rejections in a generic Error', async () => {
    const fetcher = vi.fn(() => Promise.reject('string rejection'));
    const { result } = renderHook(() => useApiData(fetcher, []));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error?.message).toBe('API unavailable');
    expect(result.current.isLive).toBe(false);
  });

  it('calls fetcher on mount', () => {
    const fetcher = vi.fn(() => new Promise<string[]>(() => {}));
    renderHook(() => useApiData(fetcher, []));

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('provides a refetch function that re-fetches data', async () => {
    const fetcher = vi.fn(() => Promise.resolve(['initial']));
    const { result } = renderHook(() => useApiData(fetcher, []));

    await waitFor(() => expect(result.current.isLive).toBe(true));

    const callsBefore = fetcher.mock.calls.length;

    // Change the return value and refetch
    fetcher.mockImplementation(() => Promise.resolve(['refreshed']));
    act(() => {
      result.current.refetch();
    });

    await waitFor(() => expect(result.current.data).toEqual(['refreshed']));
    expect(fetcher.mock.calls.length).toBeGreaterThan(callsBefore);
  });
});
