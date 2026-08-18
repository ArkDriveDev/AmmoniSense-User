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