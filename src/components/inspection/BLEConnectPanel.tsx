import React, { useEffect, useState } from 'react';
import { IonButton, IonBadge, IonSpinner, IonIcon, IonCard, IonCardContent } from '@ionic/react';
import { bluetoothOutline, refreshOutline, hardwareChipOutline, alertCircleOutline, checkmarkCircleOutline } from 'ionicons/icons';
import bluetoothClassicService, { ensureBluetoothPermissions, openBluetoothAppSettings } from '../../services/bluetoothClassicService';
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
  const [permanentlyDenied, setPermanentlyDenied] = useState<boolean>(false);

  const isConnected = status === 'connected';
  const ppmVal = latest ? latest.nh3_ppm : null;
  const { status: ppmConfirmationStatus, badgeLabel, badgeColor } = usePpmConfirmation(ppmVal, isConnected);

  useEffect(() => {
    const unsubStatus = bluetoothClassicService.onStatusChange((st, msg) => {
      setStatus(st);
      if (msg) setStatusMsg(msg);
      if (st === 'connecting') {
        setIsConnecting(true);
      } else {
        setIsConnecting(false);
      }
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
    // Ignore duplicate taps while connecting
    if (isConnecting) return;

    // Fully reset state before fresh attempt (clean retry)
    bluetoothClassicService.resetLocalState();
    setIsConnecting(true);
    setPermanentlyDenied(false);

    try {
      // 1. Gate connect behind runtime permission check (Android 12+)
      const perm = await ensureBluetoothPermissions();
      if (!perm.granted) {
        setIsConnecting(false);
        setStatus('failed');
        if (perm.permanentlyDenied) {
          setPermanentlyDenied(true);
          setStatusMsg(
            'Bluetooth permission is permanently denied. Open Settings → Apps → AmmoniSense → Permissions → Nearby devices and enable it.'
          );
        } else {
          setPermanentlyDenied(false);
          setStatusMsg('Bluetooth permission denied. Please allow Nearby devices permission in Settings.');
        }
        return;
      }

      await bluetoothClassicService.connect().catch((err) => {
        console.error('SPP connect failed (promise):', err);
        setStatus('failed');
        setStatusMsg('Device not ready. Make sure the AmmoniSense sensor is powered on.');
        return null;
      });
    } catch (e: any) {
      console.error('SPP connect failed:', e);
      setStatus('failed');
      setStatusMsg('Device not ready. Make sure the AmmoniSense sensor is powered on.');
    } finally {
      setIsConnecting(false);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'connected':
        return <IonBadge color="success">CONNECTED</IonBadge>;
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
        return <IonBadge color="warning">DEVICE NOT FOUND</IonBadge>;
      case 'failed':
        return <IonBadge color="danger">DEVICE NOT READY</IonBadge>;
      default:
        return <IonBadge color="medium">READY</IonBadge>;
    }
  };

  const sev = latest && latest.nh3_ppm !== null ? calculateAmmoniaStatus(latest.nh3_ppm) : 'NORMAL';

  return (
    <IonCard style={{ margin: '8px 0', border: isConnected ? '2px solid #10B981' : '1px solid #E2E8F0', borderRadius: '12px' }}>
      <IonCardContent style={{ padding: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <IonIcon icon={bluetoothOutline} color={isConnected ? 'success' : 'primary'} />
            <strong>AmmoniSense (Classic SPP)</strong>
          </div>
          {getStatusBadge()}
        </div>

        {/* Status Message (Honest messaging) */}
        {statusMsg && status !== 'connected' && (
          <div style={{
            marginTop: '8px',
            fontSize: '12px',
            padding: '6px 10px',
            borderRadius: '6px',
            backgroundColor: status === 'bluetooth_off' ? '#FEF2F2' : '#FFFBEB',
            color: status === 'bluetooth_off' ? '#991B1B' : '#92400E',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <IonIcon icon={alertCircleOutline} style={{ flexShrink: 0 }} />
              <span>{statusMsg}</span>
            </div>
            {permanentlyDenied && (
              <IonButton
                size="small"
                fill="outline"
                color="danger"
                onClick={() => openBluetoothAppSettings()}
                style={{ alignSelf: 'flex-start', margin: '2px 0 0 0', height: '26px', fontSize: '11px' }}
              >
                Open Settings
              </IonButton>
            )}
          </div>
        )}

        {/* Live Telemetry Display */}
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

        {/* Footer with Device Info & Retry / Connect Action */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }}>
          <span style={{ fontSize: '11px', color: '#64748B' }}>
            <IonIcon icon={hardwareChipOutline} style={{ verticalAlign: 'middle', marginRight: '3px' }} />
            {isConnected ? 'AmmoniSense (Active)' : 'Device: AmmoniSense'}
          </span>

          <IonButton
            size="small"
            fill={isConnected ? 'outline' : 'solid'}
            color={status === 'failed' || status === 'device_not_found' ? 'warning' : 'primary'}
            onClick={handleConnectOrRetry}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <>
                <IonSpinner name="dots" style={{ width: '16px', height: '16px', marginRight: '4px' }} />
                Connecting…
              </>
            ) : isConnected ? (
              <>
                <IonIcon icon={refreshOutline} slot="start" />
                Re-connect
              </>
            ) : status === 'failed' || status === 'device_not_found' || status === 'bluetooth_off' ? (
              <>
                <IonIcon icon={refreshOutline} slot="start" />
                Retry
              </>
            ) : (
              'Connect'
            )}
          </IonButton>
        </div>
      </IonCardContent>
    </IonCard>
  );
};

export default BLEConnectPanel;
