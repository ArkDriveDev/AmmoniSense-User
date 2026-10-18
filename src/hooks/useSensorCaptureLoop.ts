import { useState, useRef, useCallback, useEffect } from 'react';
import { CapturedSessionReading, CaptureStatus } from '../types/capture';
import bluetoothClassicService from '../services/bluetoothClassicService';

export const CAPTURE_INTERVAL_MS = 5000;
export const MAX_CAPTURE_READINGS = 60;

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function useSensorCaptureLoop(onReading?: (r: CapturedSessionReading) => void) {
  const [status, setStatus] = useState<CaptureStatus>('idle');
  const [readings, setReadings] = useState<CapturedSessionReading[]>([]);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const sessionIdRef = useRef<string>('');
  const tagTempIdRef = useRef<string>('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startPerfRef = useRef<number>(0);
  const accumulatedMsRef = useRef<number>(0);

  const clearTimers = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current);
    timerRef.current = null;
    elapsedTimerRef.current = null;
  };

  const recordSample = useCallback(() => {
    const raw = bluetoothClassicService.getLatestReading();
    const deviceUid = bluetoothClassicService.getDeviceUid();
    const reading: CapturedSessionReading = {
      session_id: sessionIdRef.current,
      inspection_tag_temp_id: tagTempIdRef.current,
      device_uid: deviceUid || undefined,
      nh3_ppm: typeof raw?.nh3_ppm === 'number' ? raw.nh3_ppm : 0,
      temperature: raw?.temperature ?? null,
      humidity: raw?.humidity ?? null,
      battery_percent: raw?.battery_percent ?? null,
      created_at: new Date().toISOString(),
    };
    setReadings((prev) => {
      const next = [...prev, reading];
      if (next.length >= MAX_CAPTURE_READINGS) {
        clearTimers();
        setStatus('completed');
      }
      return next;
    });
    onReading?.(reading);
  }, [onReading]);

  const start = useCallback(() => {
    const deviceUid = bluetoothClassicService.getDeviceUid();
    if (!deviceUid) {
      console.warn('[Capture] Blocked: No Bluetooth device paired.');
      return false;
    }
    clearTimers();
    sessionIdRef.current = generateUUID();
    tagTempIdRef.current = `temp_tag_${generateUUID()}`;
    setReadings([]);
    accumulatedMsRef.current = 0;
    setElapsedMs(0);
    startPerfRef.current = performance.now();
    setStatus('capturing');
    recordSample();
    timerRef.current = setInterval(recordSample, CAPTURE_INTERVAL_MS);
    elapsedTimerRef.current = setInterval(() => {
      setElapsedMs(accumulatedMsRef.current + (performance.now() - startPerfRef.current));
    }, 200);
    return true;
  }, [recordSample]);

  const pause = useCallback(() => {
    clearTimers();
    accumulatedMsRef.current += performance.now() - startPerfRef.current;
    setElapsedMs(accumulatedMsRef.current);
    setStatus('paused');
  }, []);

  const resume = useCallback(() => {
    startPerfRef.current = performance.now();
    setStatus('capturing');
    timerRef.current = setInterval(recordSample, CAPTURE_INTERVAL_MS);
    elapsedTimerRef.current = setInterval(() => {
      setElapsedMs(accumulatedMsRef.current + (performance.now() - startPerfRef.current));
    }, 200);
  }, [recordSample]);

  const stop = useCallback(() => {
    clearTimers();
    setStatus('stopped');
  }, []);

  useEffect(() => () => clearTimers(), []);

  return { status, readings, elapsedMs, sessionId: sessionIdRef.current, tagTempId: tagTempIdRef.current, start, pause, resume, stop, setStatus };
}
