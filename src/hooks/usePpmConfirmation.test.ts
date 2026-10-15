import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePpmConfirmation } from './usePpmConfirmation';

describe('usePpmConfirmation', () => {
  it('yields none status when ppm is 0 or null', () => {
    const { result } = renderHook(() => usePpmConfirmation(0, true));
    expect(result.current.status).toBe('none');
    expect(result.current.badgeLabel).toBeNull();
    expect(result.current.isConfirmed).toBe(false);
  });

  it('yields unconfirmed when ppm > 0 and connected, confirms upon manual confirm()', () => {
    const { result, rerender } = renderHook(
      ({ ppm, isConnected }) => usePpmConfirmation(ppm, isConnected),
      { initialProps: { ppm: 5.2, isConnected: true } }
    );

    expect(result.current.status).toBe('unconfirmed');
    expect(result.current.badgeLabel).toBe('Unconfirmed');
    expect(result.current.isConfirmed).toBe(false);

    // Manually confirm
    act(() => {
      result.current.confirm();
    });

    expect(result.current.status).toBe('confirmed');
    expect(result.current.badgeLabel).toBe('Confirmed');
    expect(result.current.isConfirmed).toBe(true);

    // Drops to 0 mid-stream -> resets immediately
    rerender({ ppm: 0, isConnected: true });
    expect(result.current.status).toBe('none');
    expect(result.current.badgeLabel).toBeNull();
    expect(result.current.isConfirmed).toBe(false);
  });

  it('resets immediately on disconnect', () => {
    const { result, rerender } = renderHook(
      ({ ppm, isConnected }) => usePpmConfirmation(ppm, isConnected),
      { initialProps: { ppm: 12.0, isConnected: true } }
    );

    act(() => {
      result.current.confirm();
    });
    expect(result.current.status).toBe('confirmed');

    // Disconnect
    rerender({ ppm: 12.0, isConnected: false });
    expect(result.current.status).toBe('none');
    expect(result.current.isConfirmed).toBe(false);
  });
});
