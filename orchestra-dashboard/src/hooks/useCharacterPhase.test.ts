import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCharacterPhase } from './useCharacterPhase';

describe('useCharacterPhase', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns "at-center" for initial idle status', () => {
    const { result } = renderHook(() => useCharacterPhase('idle'));
    expect(result.current).toBe('at-center');
  });

  it('returns "at-center" for initial error status', () => {
    const { result } = renderHook(() => useCharacterPhase('error'));
    expect(result.current).toBe('at-center');
  });

  // ── working → walking-to-hub → at-hub-pickup → walking-to-desk → at-desk-working ──

  it('transitions to "walking-to-hub" immediately when status changes to "working"', () => {
    const { result, rerender } = renderHook(
      ({ status }) => useCharacterPhase(status),
      { initialProps: { status: 'idle' as const } },
    );
    expect(result.current).toBe('at-center');

    rerender({ status: 'working' as const });
    expect(result.current).toBe('walking-to-hub');
  });

  it('transitions to "at-hub-pickup" after 800ms when working', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ status }) => useCharacterPhase(status),
      { initialProps: { status: 'idle' as const } },
    );

    rerender({ status: 'working' as const });
    expect(result.current).toBe('walking-to-hub');

    // Advance to 800ms → at-hub-pickup
    act(() => {
      vi.advanceTimersByTime(800);
    });
    expect(result.current).toBe('at-hub-pickup');

    vi.useRealTimers();
  });

  it('transitions to "walking-to-desk" after 1400ms when working', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ status }) => useCharacterPhase(status),
      { initialProps: { status: 'idle' as const } },
    );

    rerender({ status: 'working' as const });

    act(() => {
      vi.advanceTimersByTime(1400);
    });
    expect(result.current).toBe('walking-to-desk');

    vi.useRealTimers();
  });

  it('transitions to "at-desk-working" after 2600ms when working', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ status }) => useCharacterPhase(status),
      { initialProps: { status: 'idle' as const } },
    );

    rerender({ status: 'working' as const });

    act(() => {
      vi.advanceTimersByTime(2600);
    });
    expect(result.current).toBe('at-desk-working');

    vi.useRealTimers();
  });

  it('completes full working transition chain: walking-to-hub → at-hub-pickup → walking-to-desk → at-desk-working', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ status }) => useCharacterPhase(status),
      { initialProps: { status: 'idle' as const } },
    );

    // Start idle
    expect(result.current).toBe('at-center');

    // Change to working → immediate walking-to-hub
    rerender({ status: 'working' as const });
    expect(result.current).toBe('walking-to-hub');

    // 800ms → at-hub-pickup
    act(() => { vi.advanceTimersByTime(800); });
    expect(result.current).toBe('at-hub-pickup');

    // 1400ms total → walking-to-desk (advance 600ms more from 800)
    act(() => { vi.advanceTimersByTime(600); });
    expect(result.current).toBe('walking-to-desk');

    // 2600ms total → at-desk-working (advance 1200ms more from 1400)
    act(() => { vi.advanceTimersByTime(1200); });
    expect(result.current).toBe('at-desk-working');

    vi.useRealTimers();
  });

  // ── done → celebrating → walking-to-center → at-center ──

  it('transitions to "celebrating" when status changes to "done"', () => {
    const { result, rerender } = renderHook(
      ({ status }) => useCharacterPhase(status),
      { initialProps: { status: 'idle' as const } },
    );

    rerender({ status: 'done' as const });
    expect(result.current).toBe('celebrating');
  });

  it('transitions done → celebrating → walking-to-center → at-center', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ status }) => useCharacterPhase(status),
      { initialProps: { status: 'idle' as const } },
    );

    rerender({ status: 'done' as const });
    expect(result.current).toBe('celebrating');

    act(() => { vi.advanceTimersByTime(2000); });
    expect(result.current).toBe('walking-to-center');

    act(() => { vi.advanceTimersByTime(1200); });
    expect(result.current).toBe('at-center');

    vi.useRealTimers();
  });

  // ── error transitions ──

  it('transitions to "walking-to-center" from working when error occurs', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ status }) => useCharacterPhase(status),
      { initialProps: { status: 'idle' as const } },
    );

    // First go to working state and reach desk
    rerender({ status: 'working' as const });
    act(() => { vi.advanceTimersByTime(2600); });
    expect(result.current).toBe('at-desk-working');

    // Now error
    rerender({ status: 'error' as const });
    expect(result.current).toBe('walking-to-center');

    act(() => { vi.advanceTimersByTime(1200); });
    expect(result.current).toBe('at-center');

    vi.useRealTimers();
  });

  it('goes directly to "at-center" on error when not at desk', () => {
    const { result, rerender } = renderHook(
      ({ status }) => useCharacterPhase(status),
      { initialProps: { status: 'idle' as const } },
    );

    rerender({ status: 'error' as const });
    expect(result.current).toBe('at-center');
  });

  // ── idle transitions ──

  it('transitions to "walking-to-center" from working when idle occurs', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ status }) => useCharacterPhase(status),
      { initialProps: { status: 'idle' as const } },
    );

    // Go to working and reach desk
    rerender({ status: 'working' as const });
    act(() => { vi.advanceTimersByTime(2600); });
    expect(result.current).toBe('at-desk-working');

    // Back to idle
    rerender({ status: 'idle' as const });
    expect(result.current).toBe('walking-to-center');

    act(() => { vi.advanceTimersByTime(1200); });
    expect(result.current).toBe('at-center');

    vi.useRealTimers();
  });

  // ── generation cancellation (stale timers) ──

  it('cancels pending timers when status changes mid-transition', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ status }) => useCharacterPhase(status),
      { initialProps: { status: 'idle' as const } },
    );

    // Start working
    rerender({ status: 'working' as const });
    expect(result.current).toBe('walking-to-hub');

    // Advance 400ms (before 800ms hub-pickup timer fires)
    act(() => { vi.advanceTimersByTime(400); });
    expect(result.current).toBe('walking-to-hub');

    // Change to done — should cancel working timers
    rerender({ status: 'done' as const });
    expect(result.current).toBe('celebrating');

    // Old working timer at 800ms should not fire (would have set at-hub-pickup)
    // Advance past when the old 800ms timer would have fired
    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current).toBe('celebrating');

    // Done timers: [2000, 'walking-to-center'], [3200, 'at-center']
    // These were scheduled when rerender({done}) happened (at ~t=400ms from the effect).
    // Advance to 2000ms after the done rerender effect ran.
    // We've already advanced 500ms since the rerender, need 1500ms more.
    act(() => { vi.advanceTimersByTime(1500); });
    expect(result.current).toBe('walking-to-center');

    vi.useRealTimers();
  });

  // ── no-op when status doesn't change ──

  it('does not change phase when same status is re-applied', () => {
    const { result, rerender } = renderHook(
      ({ status }) => useCharacterPhase(status),
      { initialProps: { status: 'idle' as const } },
    );

    expect(result.current).toBe('at-center');

    // Re-render with the same status — should remain at-center
    rerender({ status: 'idle' as const });
    expect(result.current).toBe('at-center');
  });
});
