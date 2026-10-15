import { useState, useEffect, useCallback } from 'react';

export type PpmConfirmationStatus = 'none' | 'unconfirmed' | 'confirming' | 'confirmed';

export interface PpmConfirmationResult {
  status: PpmConfirmationStatus;
  badgeLabel: string | null;
  badgeColor: 'warning' | 'success' | 'medium';
  elapsedSeconds: number;
  isConfirmed: boolean;
  confirm: () => void;
  reset: () => void;
}

/**
 * Manual confirmation rule for Ammonia (PPM):
 * - 0 ppm, negative, NaN or null / not connected -> no badge ('none')
 * - Non-zero reading pending manual confirmation -> 'unconfirmed'
 * - Manually confirmed by user -> 'confirmed'
 * - Drops to 0 / null or disconnected -> resets immediately
 */
export function usePpmConfirmation(
  ppm: number | null | undefined,
  isConnected: boolean
): PpmConfirmationResult {
  const [isConfirmed, setIsConfirmed] = useState<boolean>(false);

  const reset = useCallback(() => {
    setIsConfirmed(false);
  }, []);

  const confirm = useCallback(() => {
    if (isConnected && ppm !== null && ppm !== undefined && !isNaN(ppm) && ppm > 0) {
      setIsConfirmed(true);
    }
  }, [isConnected, ppm]);

  useEffect(() => {
    // If disconnected or invalid/zero ppm, automatically reset confirmation
    if (!isConnected || ppm === null || ppm === undefined || isNaN(ppm) || ppm <= 0) {
      setIsConfirmed(false);
    }
  }, [ppm, isConnected]);

  const isValidReading = isConnected && ppm !== null && ppm !== undefined && !isNaN(ppm) && ppm > 0;

  let status: PpmConfirmationStatus = 'none';
  if (isValidReading) {
    status = isConfirmed ? 'confirmed' : 'unconfirmed';
  }

  const badgeLabel =
    status === 'confirmed'
      ? 'Confirmed'
      : status === 'unconfirmed'
      ? 'Unconfirmed'
      : null;

  const badgeColor: 'warning' | 'success' | 'medium' =
    status === 'confirmed'
      ? 'success'
      : status === 'unconfirmed'
      ? 'warning'
      : 'medium';

  return {
    status,
    badgeLabel,
    badgeColor,
    elapsedSeconds: 0,
    isConfirmed,
    confirm,
    reset,
  };
}

export default usePpmConfirmation;
