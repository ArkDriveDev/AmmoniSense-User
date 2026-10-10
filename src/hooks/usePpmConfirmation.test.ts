import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePpmConfirmation } from './usePpmConfirmation';

describe('usePpmConfirmation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('yields none status when ppm is 0 or null', () => {
    const { result } = renderHook(() => usePpmConfirmation(0, true));
    expect(result.current.status).toBe('none');
    expect(result.current.badgeLabel).toBeNull();
  });

  it('starts confirming when ppm > 0 and confirms after 10 seconds', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    const { result, rerender } = renderHook(
      ({ ppm, isConnected }) => usePpmConfirmation(ppm, isConnected),
      { initialProps: { ppm: 5.2, isConnected: true } }
    );

    expect(result.current.status).toBe('confirming');

    // Advance 5 seconds
    now += 5000;
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.status).toBe('confirming');

    // Advance past 10 seconds
    now += 5100;
    act(() => {
      vi.advanceTimersByTime(5100);
    });
    expect(result.current.status).toBe('confirmed');
    expect(result.current.badgeLabel).toBe('Confirmed');

    // Drops to 0 mid-stream -> resets immediately
    rerender({ ppm: 0, isConnected: true });
    expect(result.current.status).toBe('none');
    expect(result.current.badgeLabel).toBeNull();
  });

  it('resets immediately on disconnect', () => {
    let now = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);

    const { result, rerender } = renderHook(
      ({ ppm, isConnected }) => usePpmConfirmation(ppm, isConnected),
      { initialProps: { ppm: 12.0, isConnected: true } }
    );

    now += 11000;
    act(() => {
      vi.advanceTimersByTime(11000);
    });
    expect(result.current.status).toBe('confirmed');

    // Disconnect
    rerender({ ppm: 12.0, isConnected: false });
    expect(result.current.status).toBe('none');
  });
});
