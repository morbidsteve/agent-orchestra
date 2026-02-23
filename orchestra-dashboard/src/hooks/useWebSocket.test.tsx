import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWebSocket } from './useWebSocket.ts';

class MockWebSocket {
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  close = vi.fn();
  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
  static instances: MockWebSocket[] = [];
  static clear() {
    MockWebSocket.instances = [];
  }
}

describe('useWebSocket', () => {
  beforeEach(() => {
    MockWebSocket.clear();
    vi.stubGlobal('WebSocket', MockWebSocket);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns initial state when executionId is null', () => {
    const { result } = renderHook(() => useWebSocket(null));

    expect(result.current.connected).toBe(false);
    expect(result.current.lines).toEqual([]);
    expect(result.current.currentPhase).toBeNull();
    expect(result.current.status).toBeNull();
  });

  it('does not create a WebSocket when executionId is null', () => {
    renderHook(() => useWebSocket(null));

    expect(MockWebSocket.instances).toHaveLength(0);
  });

  it('connects when executionId is provided', () => {
    renderHook(() => useWebSocket('exec-001'));

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toContain('/api/ws/exec-001');
  });

  it('encodes executionId in the URL', () => {
    renderHook(() => useWebSocket('exec with spaces'));

    expect(MockWebSocket.instances[0].url).toContain('/api/ws/exec%20with%20spaces');
  });

  it('sets connected to true on open', () => {
    const { result } = renderHook(() => useWebSocket('exec-001'));
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.onopen?.();
    });

    expect(result.current.connected).toBe(true);
  });

  it('handles output messages', () => {
    const { result } = renderHook(() => useWebSocket('exec-001'));
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.onopen?.();
    });

    act(() => {
      ws.onmessage?.({
        data: JSON.stringify({ type: 'output', line: 'Hello world', phase: 'develop' }),
      });
    });

    expect(result.current.lines).toEqual(['Hello world']);
    expect(result.current.currentPhase).toBe('develop');
  });

  it('accumulates multiple output lines', () => {
    const { result } = renderHook(() => useWebSocket('exec-001'));
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.onopen?.();
    });

    act(() => {
      ws.onmessage?.({
        data: JSON.stringify({ type: 'output', line: 'Line 1', phase: 'develop' }),
      });
    });

    act(() => {
      ws.onmessage?.({
        data: JSON.stringify({ type: 'output', line: 'Line 2', phase: 'develop' }),
      });
    });

    expect(result.current.lines).toEqual(['Line 1', 'Line 2']);
  });

  it('handles phase messages', () => {
    const { result } = renderHook(() => useWebSocket('exec-001'));
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.onopen?.();
    });

    act(() => {
      ws.onmessage?.({
        data: JSON.stringify({ type: 'phase', phase: 'test', status: 'running' }),
      });
    });

    expect(result.current.currentPhase).toBe('test');
    expect(result.current.status).toBe('running');
  });

  it('handles complete messages', () => {
    const { result } = renderHook(() => useWebSocket('exec-001'));
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.onopen?.();
    });

    act(() => {
      ws.onmessage?.({
        data: JSON.stringify({ type: 'complete', status: 'completed' }),
      });
    });

    expect(result.current.status).toBe('completed');
  });

  it('sets connected to false on close', () => {
    const { result } = renderHook(() => useWebSocket('exec-001'));
    const ws = MockWebSocket.instances[0];

    act(() => {
      ws.onopen?.();
    });

    expect(result.current.connected).toBe(true);

    act(() => {
      ws.onclose?.();
    });

    expect(result.current.connected).toBe(false);
  });

  it('attempts reconnection after close', () => {
    renderHook(() => useWebSocket('exec-001'));

    expect(MockWebSocket.instances).toHaveLength(1);

    const ws = MockWebSocket.instances[0];
    act(() => {
      ws.onclose?.();
    });

    // Advance past the 3-second reconnect timer
    act(() => {
      vi.advanceTimersByTime(3000);
    });

    expect(MockWebSocket.instances).toHaveLength(2);
  });

  it('closes WebSocket on unmount', () => {
    const { unmount } = renderHook(() => useWebSocket('exec-001'));
    const ws = MockWebSocket.instances[0];

    unmount();

    expect(ws.close).toHaveBeenCalled();
  });

  it('closes WebSocket when executionId changes', () => {
    const { rerender } = renderHook(
      ({ id }: { id: string | null }) => useWebSocket(id),
      { initialProps: { id: 'exec-001' as string | null } },
    );

    const ws1 = MockWebSocket.instances[0];
    rerender({ id: 'exec-002' });

    expect(ws1.close).toHaveBeenCalled();
    expect(MockWebSocket.instances).toHaveLength(2);
  });

  it('uses ws: protocol for http: locations', () => {
    renderHook(() => useWebSocket('exec-001'));

    const ws = MockWebSocket.instances[0];
    expect(ws.url).toMatch(/^ws:/);
  });
});
