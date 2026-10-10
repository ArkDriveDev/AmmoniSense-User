import { useState, useEffect, useRef } from 'react';

export type PpmConfirmationStatus = 'none' | 'confirming' | 'confirmed';

export interface PpmConfirmationResult {
  status: PpmConfirmationStatus;
  badgeLabel: string | null;
  badgeColor: 'warning' | 'success' | 'medium';
  elapsedSeconds: number;
  isConfirmed: boolean;
  reset: () => void;
}

/**
 * 10-second confirmation rule for Ammonia (PPM):
 * - 0 ppm or null -> no badge ('none')
 * - Non-zero but < 10 s continuous -> "Confirming…" ('confirming')
 * - Non-zero and >= 10 s continuous -> "Confirmed" ('confirmed')
 * - Drops to 0 / null mid-window -> timer resets immediately
 * - Reset on disconnect/reconnect
 */
export function usePpmConfirmation(
  ppm: number | null | undefined,
  isConnected: boolean
): PpmConfirmationResult {
  const [status, setStatus] = useState<PpmConfirmationStatus>('none');
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  const startTimeRef = useRef<number | null>(null);

  const reset = () => {
    startTimeRef.current = null;
    setStatus('none');
    setElapsedSeconds(0);
  };

  useEffect(() => {
    // If not connected, reset immediately
    if (!isConnected) {
      reset();
      return;
    }

    // If ppm is zero, negative, or missing, reset immediately
    if (ppm === null || ppm === undefined || ppm <= 0) {
      reset();
      return;
    }

    // Non-zero ppm: start timer if not already started
    if (startTimeRef.current === null) {
      startTimeRef.current = performance.now();
      setStatus('confirming');
      setElapsedSeconds(0);
    }

    const interval = setInterval(() => {
      if (startTimeRef.current === null) return;

      const elapsed = (performance.now() - startTimeRef.current) / 1000;
      setElapsedSeconds(Math.min(10, Math.floor(elapsed)));

      if (elapsed >= 10) {
        setStatus('confirmed');
      } else {
        setStatus('confirming');
      }
    }, 200);

    return () => clearInterval(interval);
  }, [ppm, isConnected]);

  const badgeLabel =
    status === 'confirmed'
      ? 'Confirmed'
      : status === 'confirming'
      ? `Confirming… (${elapsedSeconds}s)`
      : null;

  const badgeColor =
    status === 'confirmed'
      ? 'success'
      : status === 'confirming'
      ? 'warning'
      : 'medium';

  return {
    status,
    badgeLabel,
    badgeColor,
    elapsedSeconds,
    isConfirmed: status === 'confirmed',
    reset,
  };
}

export default usePpmConfirmation;
