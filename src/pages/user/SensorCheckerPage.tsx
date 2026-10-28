import React, { useEffect, useState, useCallback } from 'react';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonGrid, IonButton, IonBadge, IonSpinner, IonIcon } from '@ionic/react';
import { bluetoothOutline, closeCircleOutline, alertCircleOutline } from 'ionicons/icons';
import bluetoothClassicService from '../../services/bluetoothClassicService';
import LiveReadingsPanel from '../../components/checker/LiveReadingsPanel';
import { AmmoniSenseReading, BluetoothConnectionStatus } from '../../types/schema';

export default function SensorCheckerPage() {
  const [status, setStatus] = useState<BluetoothConnectionStatus>(bluetoothClassicService.getStatus());
  const [reading, setReading] = useState<AmmoniSenseReading | null>(bluetoothClassicService.getLatestReading());
  const [isBtEnabled, setIsBtEnabled] = useState<boolean>(true);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const checkBt = useCallback(async () => {
    setIsBtEnabled(await bluetoothClassicService.checkLiveBluetoothEnabled());
  }, []);

  useEffect(() => {
    checkBt();
    const unsub = bluetoothClassicService.onStatusChange((st) => {
      setStatus(st);
      setIsConnecting(st === 'connecting' || st === 'scanning');
      if (st === 'connected') setErrorMessage(null);
      else if (st === 'failed' || st === 'device_not_found') setErrorMessage('Device not ready. Check the sensor is on.');
    });
    const unsubReading = bluetoothClassicService.onReading((r) => setReading(r));
    return () => {
      unsub();
      unsubReading();
    };
  }, [checkBt]);

  const handleConnect = async () => {
    if (isConnecting) return;
    setErrorMessage(null);
    setIsConnecting(true);
    try {
      const res = await bluetoothClassicService.connect();
      if (!res && bluetoothClassicService.getStatus() !== 'connected') {
        setErrorMessage('Device not ready. Check the sensor is on.');
      }
    } catch {
      setErrorMessage('Device not ready. Check the sensor is on.');
    } finally {
      setIsConnecting(false);
    }
  };

  const isConnected = status === 'connected';

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar style={{ '--background': 'linear-gradient(135deg, #0F3C5C 0%, #1D5D9B 100%)', '--color': '#ffffff' }}>
          <IonTitle style={{ fontWeight: 700 }}>Sensor Checker</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" style={{ '--background': '#F1F5F9' }}>
        <IonGrid style={{ maxWidth: '800px', margin: '0 auto', padding: 0 }}>
          {/* Bluetooth Header & Connect Button */}
          <div style={{ background: '#FFFFFF', borderRadius: '14px', padding: '16px', border: '1px solid #E2E8F0', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                  Bluetooth: {!isBtEnabled ? 'Off' : isConnected ? 'Connected' : 'On'}
                </div>
                <h3 style={{ margin: '4px 0 0 0', fontWeight: 700, fontSize: '17px', color: '#0F172A' }}>AmmoniSense Sensor</h3>
              </div>
              {isConnected ? (
                <IonBadge color="success">CONNECTED</IonBadge>
              ) : isConnecting ? (
                <IonBadge color="warning"><IonSpinner name="dots" style={{ width: '12px', height: '12px', marginRight: '4px' }} />CONNECTING</IonBadge>
              ) : (
                <IonBadge color="medium">DISCONNECTED</IonBadge>
              )}
            </div>

            {errorMessage && (
              <div style={{ marginTop: '12px', padding: '8px 12px', borderRadius: '8px', background: '#FEF2F2', color: '#991B1B', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <IonIcon icon={alertCircleOutline} style={{ flexShrink: 0 }} /><span>{errorMessage}</span>
              </div>
            )}

            <div style={{ marginTop: '14px' }}>
              {isConnected ? (
                <IonButton expand="block" color="danger" fill="outline" onClick={() => bluetoothClassicService.disconnect()}>
                  <IonIcon icon={closeCircleOutline} slot="start" />Disconnect
                </IonButton>
              ) : (
                <IonButton expand="block" color="primary" onClick={handleConnect} disabled={isConnecting || !isBtEnabled}>
                  {isConnecting ? <><IonSpinner name="dots" style={{ width: '16px', height: '16px', marginRight: '6px' }} />Connecting…</> : <><IonIcon icon={bluetoothOutline} slot="start" />Connect</>}
                </IonButton>
              )}
            </div>
          </div>

          {/* Live Readings Panel */}
          <LiveReadingsPanel reading={reading} isConnected={isConnected} />
        </IonGrid>
      </IonContent>
    </IonPage>
  );
}
