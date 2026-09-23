import React, { useEffect, useState } from 'react';
import { IonButton, IonBadge, IonSpinner, IonIcon, IonCard, IonCardContent } from '@ionic/react';
import { bluetoothOutline, refreshOutline, hardwareChipOutline } from 'ionicons/icons';
import bleCentralService, { BLECentralReading, BLECentralState } from '../../services/bleCentralService';
import { calculateAmmoniaStatus } from '../../types/inspection';

interface Props {
  onReadingCaptured: (r: { ammonia: number; temperature: number; humidity: number; battery: number; device_uid?: string }) => void;
}

export const BLEConnectPanel: React.FC<Props> = ({ onReadingCaptured }) => {
  const [bleState, setBleState] = useState<BLECentralState>('disconnected');
  const [latest, setLatest] = useState<BLECentralReading | null>(null);
  const [deviceUid, setDeviceUid] = useState<string>('');
  const [registered, setRegistered] = useState<boolean>(false);

  useEffect(() => {
    const unsubState = bleCentralService.onStateChange(setBleState);
    const unsubTelem = bleCentralService.onTelemetry((r) => {
      setLatest(r);
      setDeviceUid(r.device_id);
      onReadingCaptured({ ammonia: r.ammonia_ppm, temperature: r.temperature_c, humidity: r.humidity_pct, battery: r.battery_pct ?? 100, device_uid: r.device_id });
    });
    const unsubReg = bleCentralService.onDeviceAutoRegistered((rec) => {
      setRegistered(true);
      setDeviceUid(rec.device_uid);
    });
    const dev = bleCentralService.getActiveDevice();
    if (dev) setDeviceUid(dev.id);
    return () => { unsubState(); unsubTelem(); unsubReg(); };
  }, []);

  const handleScanAndConnect = async () => {
    try {
      const devs = await bleCentralService.scanForDevices();
      if (devs.length > 0) {
        await bleCentralService.connectAndSubscribe(devs[0]);
      }
    } catch (e: any) {
      alert(e.message || 'BLE error');
    }
  };

  const isConn = bleState === 'connected' || bleState === 'streaming';
  const sev = latest ? calculateAmmoniaStatus(latest.ammonia_ppm) : 'NORMAL';

  return (
    <IonCard style={{ margin: '8px 0', border: isConn ? '2px solid #10B981' : '1px solid #E2E8F0' }}>
      <IonCardContent style={{ padding: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <IonIcon icon={bluetoothOutline} color={isConn ? 'success' : 'primary'} />
            <strong>Sensor Telemetry</strong>
          </div>
          <IonBadge color={isConn ? 'success' : bleState === 'scanning' ? 'warning' : 'medium'}>{bleState.toUpperCase()}</IonBadge>
        </div>
        {latest && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', margin: '10px 0' }}>
            <div style={{ background: '#F1F5F9', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#64748B' }}>AMMONIA</div>
              <div style={{ fontSize: '17px', fontWeight: 800, color: sev === 'NORMAL' ? '#10B981' : '#EF4444' }}>{latest.ammonia_ppm.toFixed(2)} PPM</div>
            </div>
            <div style={{ background: '#F1F5F9', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
              <div style={{ fontSize: '11px', color: '#64748B' }}>TEMP / HUM</div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#1E293B', marginTop: '2px' }}>{latest.temperature_c.toFixed(1)}°C | {latest.humidity_pct.toFixed(0)}%</div>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
          <span style={{ fontSize: '11px', color: '#64748B' }}>
            {deviceUid ? <><IonIcon icon={hardwareChipOutline} /> {deviceUid} {registered && '✓'}</> : 'Disconnected'}
          </span>
          <IonButton size="small" fill="outline" onClick={handleScanAndConnect} disabled={bleState === 'scanning'}>
            {bleState === 'scanning' ? <IonSpinner name="dots" /> : isConn ? <><IonIcon icon={refreshOutline} slot="start" /> Rescan</> : 'Connect'}
          </IonButton>
        </div>
      </IonCardContent>
    </IonCard>
  );
};
export default BLEConnectPanel;
