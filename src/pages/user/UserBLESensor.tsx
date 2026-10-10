import React, { useEffect, useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonIcon,
  IonGrid,
  IonToast,
  IonRefresher,
  IonRefresherContent,
  IonSpinner
} from '@ionic/react';
import {
  bluetoothOutline,
  refreshOutline,
  cloudUploadOutline,
  checkmarkCircleOutline,
  hardwareChipOutline
} from 'ionicons/icons';
import { useNavigate } from 'react-router-dom';
import BLEReadingDisplay from '../../components/BLEReadingDisplay';
import bluetoothClassicService from '../../services/bluetoothClassicService';
import { AmmoniSenseReading, BluetoothConnectionStatus } from '../../types/schema';
import offlineStorage from '../../services/OfflineStorageService';

export default function UserBLESensor() {
  const navigate = useNavigate();
  const [reading, setReading] = useState<AmmoniSenseReading | null>(bluetoothClassicService.getLatestReading());
  const [status, setStatus] = useState<BluetoothConnectionStatus>(bluetoothClassicService.getStatus());
  const [statusMsg, setStatusMsg] = useState<string>(bluetoothClassicService.getStatusMessage());
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  // Toast
  const [toastMsg, setToastMsg] = useState<string>('');
  const [showToast, setShowToast] = useState<boolean>(false);

  useEffect(() => {
    bluetoothClassicService.checkLiveStateAndNotify();

    const unsubReading = bluetoothClassicService.onReading((r) => {
      setReading(r);
    });

    const unsubStatus = bluetoothClassicService.onStatusChange((st, msg) => {
      setStatus(st);
      if (msg) setStatusMsg(msg);
      setIsConnecting(st === 'connecting');
    });

    return () => {
      unsubReading();
      unsubStatus();
    };
  }, []);

  const handleRefresh = async (event: CustomEvent) => {
    await bluetoothClassicService.checkLiveStateAndNotify();
    event.detail.complete();
  };

  const handleConnect = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    try {
      await bluetoothClassicService.connect();
    } catch (err: any) {
      setToastMsg('Connection failed: ' + (err?.message || 'Error'));
      setShowToast(true);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleAutoPopulateAndSubmit = () => {
    if (!reading) {
      setToastMsg('No active sensor reading available. Connect to AmmoniSense first.');
      setShowToast(true);
      return;
    }

    // Save reading to offline draft / localStorage so inspection tags can load it
    offlineStorage.saveDraft('draft_ble_central_reading', {
      device_id: 'AmmoniSense',
      device_name: 'AmmoniSense',
      ammonia_ppm: reading.nh3_ppm ?? 0,
      temperature_c: reading.temperature ?? 0,
      humidity_pct: reading.humidity ?? 0,
      battery_pct: reading.battery_percent ?? 0,
      timestamp: reading.timestamp,
    });
    navigate('/schedules');
  };

  const isConnected = status === 'connected';

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar style={{ '--background': 'linear-gradient(135deg, #0F3C5C 0%, #1D5D9B 100%)', '--color': '#ffffff' }}>
          <IonTitle style={{ fontWeight: 700 }}>AmmoniSense Sensor Reader</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" style={{ '--background': '#F1F5F9' }}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <IonGrid style={{ maxWidth: '800px', margin: '0 auto', padding: 0 }}>
          {/* Header Card */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(15, 60, 92, 0.95), rgba(29, 93, 155, 0.9))',
              borderRadius: '16px',
              padding: '16px',
              color: '#ffffff',
              marginBottom: '16px',
              boxShadow: '0 6px 20px rgba(15, 60, 92, 0.2)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.85, fontWeight: 700 }}>
                  PROTOCOL: CLASSIC BLUETOOTH SERIAL (SPP)
                </span>
                <h3 style={{ margin: '2px 0 0 0', fontWeight: 800, fontSize: '18px' }}>
                  {isConnected ? 'Connected to AmmoniSense' : 'AmmoniSense ESP32'}
                </h3>
              </div>
              <IonButton
                size="small"
                fill="outline"
                color="light"
                onClick={handleConnect}
                disabled={isConnecting}
                style={{ fontWeight: 700 }}
              >
                {isConnecting ? (
                  <>
                    <IonSpinner name="dots" style={{ width: '14px', height: '14px', marginRight: '4px' }} />
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
                  <>
                    <IonIcon icon={bluetoothOutline} slot="start" />
                    Connect
                  </>
                )}
              </IonButton>
            </div>
          </div>

          {/* Real-time Telemetry Display */}
          <BLEReadingDisplay reading={reading} isConnected={isConnected} />

          {/* Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <IonButton
              expand="block"
              color="success"
              size="large"
              onClick={handleAutoPopulateAndSubmit}
              disabled={!reading}
              style={{ fontWeight: 700 }}
            >
              <IonIcon icon={cloudUploadOutline} slot="start" />
              Auto-Populate & Submit to Inspection Form
            </IonButton>
          </div>
        </IonGrid>

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMsg}
          duration={3500}
          position="bottom"
        />
      </IonContent>
    </IonPage>
  );
}
