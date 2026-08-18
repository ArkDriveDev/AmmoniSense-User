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
  IonRefresherContent
} from '@ionic/react';
import {
  bluetoothOutline,
  searchOutline,
  cloudUploadOutline
} from 'ionicons/icons';
import { useNavigate } from 'react-router-dom';
import BLEScanner from '../../components/BLEScanner';
import BLEReadingDisplay from '../../components/BLEReadingDisplay';
import bleCentralService, { BLECentralReading, BLECentralDevice } from '../../services/bleCentralService';
import offlineStorage from '../../services/OfflineStorageService';

export default function UserBLESensor() {
  const navigate = useNavigate();
  const [reading, setReading] = useState<BLECentralReading | null>(null);
  const [activeDevice, setActiveDevice] = useState<BLECentralDevice | null>(null);
  const [showScannerModal, setShowScannerModal] = useState<boolean>(false);

  // Toast
  const [toastMsg, setToastMsg] = useState<string>('');
  const [showToast, setShowToast] = useState<boolean>(false);

  useEffect(() => {
    const unsubTelemetry = bleCentralService.onTelemetry((telemetry) => {
      setReading(telemetry);
    });

    setActiveDevice(bleCentralService.getActiveDevice());

    return () => {
      unsubTelemetry();
    };
  }, []);

  const handleRefresh = async (event: CustomEvent) => {
    await bleCentralService.scanForDevices();
    event.detail.complete();
  };

  const handleAutoPopulateAndSubmit = () => {
    if (!reading) {
      setToastMsg('No active BLE reading available. Connect to a BLE node first.');
      setShowToast(true);
      return;
    }

    // Save reading to offline draft / localStorage so SensorSubmissionForm loads it
    offlineStorage.saveDraft('draft_ble_central_reading', reading);
    navigate('/sensor-data');
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar style={{ '--background': 'linear-gradient(135deg, #0F3C5C 0%, #1D5D9B 100%)', '--color': '#ffffff' }}>
          <IonTitle style={{ fontWeight: 700 }}>BLE Central Scanner & Reader</IonTitle>
          <IonButton slot="end" fill="clear" onClick={() => setShowScannerModal(true)} style={{ color: '#ffffff' }}>
            <IonIcon icon={searchOutline} />
          </IonButton>
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
                  CENTRAL ROLE (SCANNER / READER ONLY)
                </span>
                <h3 style={{ margin: '2px 0 0 0', fontWeight: 800, fontSize: '18px' }}>
                  {activeDevice ? activeDevice.name : 'Ready for Scanning'}
                </h3>
              </div>
              <IonButton size="small" fill="outline" color="light" onClick={() => setShowScannerModal(true)} style={{ fontWeight: 700 }}>
                <IonIcon icon={bluetoothOutline} slot="start" />
                Scan Devices
              </IonButton>
            </div>
          </div>

          {/* Real-time Telemetry Display */}
          <BLEReadingDisplay reading={reading} />

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

        <BLEScanner
          isOpen={showScannerModal}
          onClose={() => setShowScannerModal(false)}
          onSelectDevice={(device) => setActiveDevice(device)}
        />

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
