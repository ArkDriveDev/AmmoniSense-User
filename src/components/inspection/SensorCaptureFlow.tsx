import React, { useEffect, useState, useRef } from 'react';
import { IonButton, IonIcon, IonBadge, IonProgressBar } from '@ionic/react';
import { playOutline, pauseOutline, stopOutline, alertCircleOutline, refreshOutline } from 'ionicons/icons';
import { useSensorCaptureLoop, MAX_CAPTURE_READINGS } from '../../hooks/useSensorCaptureLoop';
import { persistCaptureReading } from '../../services/captureStorageService';
import bluetoothClassicService from '../../services/bluetoothClassicService';
import SensorStabilization from './SensorStabilization';
import { CapturedSessionReading } from '../../types/capture';

interface Props {
  isConnected: boolean;
  onComplete: (readings: CapturedSessionReading[], sessionId: string, tagTempId: string) => void;
}

export const SensorCaptureFlow: React.FC<Props> = ({ isConnected, onComplete }) => {
  const [isStabilized, setIsStabilized] = useState(false);
  const [bleDrop, setBleDrop] = useState(false);
  const hasReportedRef = useRef(false);
  const { status, readings, elapsedMs, sessionId, tagTempId, start, pause, resume, stop } =
    useSensorCaptureLoop(persistCaptureReading);

  useEffect(() => {
    return bluetoothClassicService.onStatusChange((st) => {
      if (st !== 'connected' && status === 'capturing') {
        pause();
        setBleDrop(true);
      }
    });
  }, [status, pause]);

  useEffect(() => {
    if (!hasReportedRef.current && (status === 'completed' || status === 'stopped') && readings.length > 0) {
      hasReportedRef.current = true;
      onComplete(readings, sessionId, tagTempId);
    }
  }, [status, readings, sessionId, tagTempId, onComplete]);

  const sec = Math.min(300, Math.floor(elapsedMs / 1000));
  const timeStr = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
  const latestPpm = readings.length > 0 ? readings[readings.length - 1].nh3_ppm : (bluetoothClassicService.getLatestReading()?.nh3_ppm ?? 0);

  const handleStart = () => {
    hasReportedRef.current = false;
    start();
  };

  return (
    <div style={{ marginTop: '14px', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '14px', background: '#FFFFFF' }}>
      {!isStabilized && isConnected && (
        <SensorStabilization isActive={isConnected} onComplete={() => setIsStabilized(true)} />
      )}
      {isStabilized && status === 'idle' && (
        <div style={{ textAlign: 'center', padding: '10px 0' }}>
          <IonBadge color="success" style={{ marginBottom: '10px' }}>SENSOR READY</IonBadge>
          <IonButton expand="block" color="primary" onClick={handleStart}>
            <IonIcon icon={playOutline} slot="start" /> Start 5-Minute Capture
          </IonButton>
        </div>
      )}
      {(status === 'capturing' || status === 'paused') && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#1E293B' }}>
              Capturing… {readings.length}/{MAX_CAPTURE_READINGS}
            </span>
            <IonBadge color={status === 'capturing' ? 'primary' : 'warning'}>{timeStr} / 05:00</IonBadge>
          </div>
          <IonProgressBar value={readings.length / MAX_CAPTURE_READINGS} color="primary" style={{ height: '8px', borderRadius: '4px', margin: '10px 0' }} />
          <div style={{ textAlign: 'center', background: '#F1F5F9', borderRadius: '8px', padding: '12px', margin: '10px 0' }}>
            <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>LIVE AMMONIA CONCENTRATION</div>
            <div style={{ fontSize: '26px', fontWeight: 800, color: '#2563EB' }}>{latestPpm.toFixed(2)} PPM</div>
          </div>
          {bleDrop && (
            <div style={{ padding: '8px', background: '#FEF2F2', color: '#991B1B', borderRadius: '6px', fontSize: '12px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <IonIcon icon={alertCircleOutline} /> BLE connection dropped. Reconnect and resume.
            </div>
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            {status === 'capturing' ? (
              <IonButton fill="outline" color="warning" style={{ flex: 1 }} onClick={pause}>
                <IonIcon icon={pauseOutline} slot="start" /> Pause
              </IonButton>
            ) : (
              <IonButton fill="outline" color="success" style={{ flex: 1 }} onClick={() => { setBleDrop(false); resume(); }}>
                <IonIcon icon={refreshOutline} slot="start" /> Resume
              </IonButton>
            )}
            <IonButton color="danger" style={{ flex: 1 }} onClick={stop}>
              <IonIcon icon={stopOutline} slot="start" /> Stop
            </IonButton>
          </div>
        </div>
      )}
    </div>
  );
};

export default SensorCaptureFlow;
