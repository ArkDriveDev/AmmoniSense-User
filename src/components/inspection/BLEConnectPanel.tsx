import React, { useEffect, useState } from 'react';
import { IonButton, IonBadge, IonSpinner, IonIcon, IonCard, IonCardContent } from '@ionic/react';
import {
  bluetoothOutline,
  refreshOutline,
  hardwareChipOutline,
  alertCircleOutline,
  checkmarkCircleOutline,
  searchOutline,
} from 'ionicons/icons';
import bluetoothClassicService from '../../services/bluetoothClassicService';
import { AmmoniSenseReading, BluetoothConnectionStatus } from '../../types/schema';
import { calculateAmmoniaStatus } from '../../types/inspection';
import { usePpmConfirmation } from '../../hooks/usePpmConfirmation';

interface Props {
  onReadingCaptured: (r: {
    ammonia: number | null;
    temperature: number | null;
    humidity: number | null;
    battery: number | null;
    device_uid?: string;
  }) => void;
}

export const BLEConnectPanel: React.FC<Props> = ({ onReadingCaptured }) => {
  const [status, setStatus] = useState<BluetoothConnectionStatus>(bluetoothClassicService.getStatus());
  const [statusMsg, setStatusMsg] = useState<string>(bluetoothClassicService.getStatusMessage());
  const [latest, setLatest] = useState<AmmoniSenseReading | null>(bluetoothClassicService.getLatestReading());
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  const isConnected = status === 'connected';
  const isScanning = status === 'scanning';
  const ppmVal = latest ? latest.nh3_ppm : null;
  const { badgeLabel, badgeColor } = usePpmConfirmation(ppmVal, isConnected);

  useEffect(() => {
    const unsubStatus = bluetoothClassicService.onStatusChange((st, msg) => {
      setStatus(st);
      if (msg) setStatusMsg(msg);
      setIsConnecting(st === 'connecting' || st === 'scanning');
    });

    const unsubReading = bluetoothClassicService.onReading((reading) => {
      setLatest(reading);
      onReadingCaptured({
        ammonia: reading.nh3_ppm,
        temperature: reading.temperature,
        humidity: reading.humidity,
        battery: reading.battery_percent,
        device_uid: 'AmmoniSense',
      });
    });

    return () => {
      unsubStatus();
      unsubReading();
    };
  }, []);

  const handleConnectOrRetry = async () => {
    if (isConnecting) return;

    bluetoothClassicService.resetLocalState();
    setIsConnecting(true);

    try {
      await bluetoothClassicService.connect().catch((err) => {
        console.error('[BLEConnectPanel] SPP connect error:', err);
        return null;
      });
    } catch (e: any) {
      console.error('[BLEConnectPanel] SPP connect failed:', e);
    } finally {
      setIsConnecting(false);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'connected':
        return <IonBadge color="success">CONNECTED</IonBadge>;
      case 'scanning':
        return (
          <IonBadge color="tertiary" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <IonSpinner name="dots" style={{ width: '12px', height: '12px' }} />
            SCANNING…
          </IonBadge>
        );
      case 'connecting':
        return (
          <IonBadge color="warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <IonSpinner name="dots" style={{ width: '12px', height: '12px' }} />
            CONNECTING…
          </IonBadge>
        );
      case 'bluetooth_off':
        return <IonBadge color="danger">BLUETOOTH OFF</IonBadge>;
      case 'device_not_found':
        return <IonBadge color="warning">NOT FOUND</IonBadge>;
      case 'failed':
        return <IonBadge color="danger">NOT READY</IonBadge>;
      case 'disconnected':
        return <IonBadge color="medium">DISCONNECTED</IonBadge>;
      default:
        return <IonBadge color="medium">READY</IonBadge>;
    }
  };

  const sev = latest && latest.nh3_ppm !== null ? calculateAmmoniaStatus(latest.nh3_ppm) : 'NORMAL';

  const isError = status === 'failed' || status === 'device_not_found' || status === 'bluetooth_off';

  return (
    <IonCard style={{ margin: '8px 0', border: isConnected ? '2px solid #10B981' : '1px solid #E2E8F0', borderRadius: '12px' }}>
      <IonCardContent style={{ padding: '12px' }}>
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <IonIcon icon={bluetoothOutline} color={isConnected ? 'success' : 'primary'} />
            <strong>AmmoniSense (SPP)</strong>
          </div>
          {getStatusBadge()}
        </div>

        {/* Scan hint */}
        {!isConnected && !isConnecting && status === 'idle' && (
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <IonIcon icon={searchOutline} style={{ flexShrink: 0 }} />
            <span>Tap <b>Connect</b> to scan and pair AmmoniSense automatically.</span>
          </div>
        )}

        {/* Status error message */}
        {statusMsg && status !== 'connected' && status !== 'idle' && (
          <div style={{
            marginTop: '8px',
            fontSize: '12px',
            padding: '6px 10px',
            borderRadius: '6px',
            backgroundColor: status === 'bluetooth_off' ? '#FEF2F2' : '#FFFBEB',
            color: status === 'bluetooth_off' ? '#991B1B' : '#92400E',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}>
            <IonIcon icon={alertCircleOutline} style={{ flexShrink: 0 }} />
            <span>{statusMsg}</span>
          </div>
        )}

        {/* Live telemetry */}
        {latest && isConnected && (
          <div style={{ marginTop: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', margin: '8px 0' }}>
              {/* Ammonia */}
              <div style={{ background: '#F1F5F9', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 700 }}>AMMONIA</div>
                <div style={{ fontSize: '16px', fontWeight: 800, color: sev === 'NORMAL' ? '#10B981' : '#EF4444' }}>
                  {typeof latest?.nh3_ppm === 'number' && !isNaN(latest.nh3_ppm) ? `${latest.nh3_ppm.toFixed(2)} PPM` : '—'}
                </div>
                {badgeLabel && (
                  <div style={{ marginTop: '3px' }}>
                    <IonBadge color={badgeColor} style={{ fontSize: '9px', padding: '2px 6px' }}>
                      {badgeLabel}
                    </IonBadge>
                  </div>
                )}
              </div>

              {/* Temp / Hum */}
              <div style={{ background: '#F1F5F9', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 700 }}>TEMP / HUM</div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#1E293B', marginTop: '2px' }}>
                  {typeof latest?.temperature === 'number' && !isNaN(latest.temperature) ? `${latest.temperature.toFixed(1)}°C` : '—'}
                  {' | '}
                  {typeof latest?.humidity === 'number' && !isNaN(latest.humidity) ? `${latest.humidity.toFixed(0)}%` : '—'}
                </div>
              </div>

              {/* Battery */}
              <div style={{ background: '#F1F5F9', padding: '8px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 700 }}>BATTERY</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#1E293B', marginTop: '2px' }}>
                  {typeof latest?.battery_percent === 'number' && !isNaN(latest.battery_percent) ? `${latest.battery_percent}%` : '—'}
                </div>
                {typeof latest?.battery_voltage === 'number' && !isNaN(latest.battery_voltage) && (
                  <div style={{ fontSize: '9px', color: '#64748B' }}>
                    {latest.battery_voltage.toFixed(2)} V
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
          <span style={{ fontSize: '11px', color: '#64748B' }}>
            <IonIcon icon={hardwareChipOutline} style={{ verticalAlign: 'middle', marginRight: '3px' }} />
            {isConnected ? 'AmmoniSense (Active)' : 'Device: AmmoniSense'}
          </span>

          <IonButton
            size="small"
            fill={isConnected ? 'outline' : 'solid'}
            color={isError ? 'warning' : 'primary'}
            onClick={handleConnectOrRetry}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <>
                <IonSpinner name="dots" style={{ width: '16px', height: '16px', marginRight: '4px' }} />
                {isScanning ? 'Scanning…' : 'Connecting…'}
              </>
            ) : isConnected ? (
              <>
                <IonIcon icon={refreshOutline} slot="start" />
                Re-connect
              </>
            ) : isError ? (
              <>
                <IonIcon icon={refreshOutline} slot="start" />
                Retry
              </>
            ) : (
              <>
                <IonIcon icon={bluetoothOutline} slot="start" />
                Connect
              </>
            )}
          </IonButton>
        </div>

        {/* Connected confirmation row */}
        {isConnected && (
          <div style={{ marginTop: '6px', fontSize: '11px', color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <IonIcon icon={checkmarkCircleOutline} />
            <span>Live data streaming from AmmoniSense</span>
          </div>
        )}
      </IonCardContent>
    </IonCard>
  );
};

export default BLEConnectPanel;
