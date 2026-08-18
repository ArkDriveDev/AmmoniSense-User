import React, { useEffect, useState } from 'react';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonCard,
  IonCardContent,
  IonIcon,
  IonBadge,
  IonSpinner,
  IonList,
  IonItem,
  IonLabel,
  IonAlert
} from '@ionic/react';
import {
  bluetoothOutline,
  closeOutline,
  searchOutline,
  radioButtonOnOutline,
  checkmarkCircleOutline,
  cellularOutline,
  hardwareChipOutline,
  warningOutline,
  locationOutline,
  settingsOutline
} from 'ionicons/icons';
import bleCentralService, { BLECentralDevice, BLECentralState, BLEPermissionStatus } from '../services/bleCentralService';

interface BLEScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDevice?: (device: BLECentralDevice) => void;
}

export const BLEScanner: React.FC<BLEScannerProps> = ({
  isOpen,
  onClose,
  onSelectDevice,
}) => {
  const [devices, setDevices] = useState<BLECentralDevice[]>([]);
  const [scanning, setScanning] = useState<boolean>(false);
  const [connectionState, setConnectionState] = useState<BLECentralState>('disconnected');
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);

  // BLE & Location Permissions status state
  const [permStatus, setPermStatus] = useState<BLEPermissionStatus | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [showAlert, setShowAlert] = useState<boolean>(false);

  useEffect(() => {
    const unsubState = bleCentralService.onStateChange((state) => {
      setConnectionState(state);
      setScanning(state === 'scanning');
    });

    const unsubDevices = bleCentralService.onDevicesDiscovered((devs) => {
      setDevices(devs);
    });

    setDevices(bleCentralService.getDiscoveredDevices());

    if (isOpen) {
      checkPermissions();
    }

    return () => {
      unsubState();
      unsubDevices();
    };
  }, [isOpen]);

  const checkPermissions = async () => {
    try {
      const status = await bleCentralService.checkAndRequestPermissions();
      setPermStatus(status);
      if (!status.canScan && status.errorMsg) {
        setPermissionError(status.errorMsg);
      } else {
        setPermissionError(null);
      }
    } catch (err: any) {
      console.warn('Error checking permissions:', err);
    }
  };

  const handleStartScan = async () => {
    setScanning(true);
    setPermissionError(null);
    try {
      const devs = await bleCentralService.scanForDevices();
      setDevices(devs);
    } catch (err: any) {
      console.error('Scan error:', err);
      const errMsg = err.message || 'Failed to start scan. Check Bluetooth & Location permissions.';
      setPermissionError(errMsg);
      setShowAlert(true);
    } finally {
      setScanning(false);
      checkPermissions();
    }
  };

  const handleOpenSettings = async () => {
    await bleCentralService.openSettings();
  };

  const handleConnectDevice = async (device: BLECentralDevice) => {
    setActiveDeviceId(device.id);
    try {
      await bleCentralService.connectAndSubscribe(device);
      if (onSelectDevice) {
        onSelectDevice(device);
      }
      onClose();
    } catch (err) {
      console.error('Connect error:', err);
    }
  };

  const getRssiColor = (rssi?: number) => {
    if (!rssi) return '#94a3b8';
    if (rssi > -60) return '#22c55e'; // Excellent Green
    if (rssi > -75) return '#eab308'; // Moderate Yellow
    return '#ef4444'; // Weak Red
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      <IonHeader className="ion-no-border">
        <IonToolbar style={{ '--background': 'linear-gradient(135deg, #0F3C5C 0%, #1D5D9B 100%)', '--color': '#ffffff' }}>
          <IonTitle style={{ fontWeight: 700, fontSize: '16px' }}>
            <IonIcon icon={bluetoothOutline} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
            BLE Central Scanner
          </IonTitle>
          <IonButtons slot="end">