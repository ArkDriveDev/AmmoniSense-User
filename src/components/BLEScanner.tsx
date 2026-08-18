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
            <IonButton onClick={onClose} style={{ color: '#ffffff' }}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" style={{ '--background': '#F8FAFC' }}>
        {/* Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(15, 60, 92, 0.95), rgba(29, 93, 155, 0.9))',
            borderRadius: '16px',
            padding: '16px',
            color: '#ffffff',
            marginBottom: '12px',
            boxShadow: '0 6px 20px rgba(15, 60, 92, 0.2)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8 }}>
                ROLE: BLE CENTRAL SCANNER
              </span>
              <h3 style={{ margin: '2px 0 0 0', fontWeight: 800, fontSize: '16px' }}>GATT Service Reader</h3>
            </div>
            <IonBadge style={{ background: 'rgba(255,255,255,0.15)', color: '#ffffff', fontSize: '10px', padding: '6px 10px' }}>
              UUID: 0000ffd0...
            </IonBadge>
          </div>
        </div>

        {/* PERMISSION STATUS INDICATOR */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '12px',
            padding: '12px 14px',
            marginBottom: '14px',
            border: '1px solid rgba(226, 232, 240, 0.9)',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
            Permission Telemetry & Status
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
            <IonBadge
              style={{
                background: permStatus?.bluetoothEnabled ? '#ecfdf5' : '#fef2f2',
                color: permStatus?.bluetoothEnabled ? '#047857' : '#b91c1c',
                padding: '6px 10px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '11px',
              }}
            >
              <IonIcon icon={bluetoothOutline} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              BLE Hardware: {permStatus?.bluetoothEnabled ? 'Enabled' : 'Disabled / Restricted'}
            </IonBadge>

            <IonBadge
              style={{
                background: permStatus?.locationGranted ? '#ecfdf5' : '#fffbe0',
                color: permStatus?.locationGranted ? '#047857' : '#b45309',
                padding: '6px 10px',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '11px',
              }}
            >
              <IonIcon icon={locationOutline} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
              Location Services: {permStatus?.locationGranted ? 'Granted' : 'Required'}
            </IonBadge>
          </div>
        </div>

        {/* PERMISSION ERROR ALERT CARD */}
        {permissionError && (
          <IonCard className="premium-card" style={{ margin: '0 0 14px 0', borderLeft: '4px solid #ef4444', background: '#fff5f5' }}>
            <IonCardContent style={{ padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <IonIcon icon={warningOutline} style={{ color: '#ef4444', fontSize: '24px', marginTop: '2px' }} />
                <div style={{ flex: 1 }}>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 700, color: '#991b1b' }}>
                    Permissions or Hardware Action Required
                  </h4>
                  <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: '#7f1d1d' }}>
                    {permissionError}
                  </p>
                  <IonButton size="small" color="danger" onClick={handleOpenSettings} style={{ fontWeight: 700 }}>
                    <IonIcon icon={settingsOutline} slot="start" />
                    Open Settings / Grant Permissions
                  </IonButton>
                </div>
              </div>
            </IonCardContent>
          </IonCard>
        )}

        {/* Scan Control Action Button */}
        <IonButton
          expand="block"
          color="primary"
          onClick={handleStartScan}
          disabled={scanning}
          style={{ fontWeight: 700, marginBottom: '16px' }}
        >
          {scanning ? (
            <>
              <IonSpinner name="crescent" />
              &nbsp;Scanning BLE Central Devices...
            </>
          ) : (
            <>
              <IonIcon icon={searchOutline} slot="start" />
              Scan for BLE Sensor Devices
            </>
          )}
        </IonButton>

        {/* Device List */}
        <div style={{ marginBottom: '8px' }}>
          <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Discovered Sensor Nodes ({devices.length})
          </label>
        </div>

        {devices.length === 0 ? (
          <IonCard className="premium-card" style={{ margin: 0, padding: '24px', textAlign: 'center' }}>
            <IonCardContent>
              <IonIcon icon={bluetoothOutline} style={{ fontSize: '42px', color: '#94A3B8', marginBottom: '8px' }} />
              <p style={{ margin: 0, color: '#64748B', fontWeight: 600, fontSize: '13px' }}>
                No BLE devices found. Tap <b>Scan for BLE Sensor Devices</b> to discover nearby ESP32 nodes.
              </p>
            </IonCardContent>
          </IonCard>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {devices.map((device) => {
              const rssiColor = getRssiColor(device.rssi);
              const isConnecting = connectionState === 'connecting' && activeDeviceId === device.id;

              return (
                <IonCard key={device.id} className="premium-card" style={{ margin: 0 }}>
                  <IonCardContent style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '12px',
                          background: 'rgba(29, 93, 155, 0.1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <IonIcon icon={hardwareChipOutline} style={{ color: '#1D5D9B', fontSize: '22px' }} />
                        </div>
                        <div>
                          <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0F172A' }}>{device.name}</h4>
                          <span style={{ fontSize: '12px', color: '#64748B', fontFamily: 'monospace' }}>ID: {device.id}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                        <IonBadge style={{ background: 'rgba(0,0,0,0.06)', color: rssiColor, fontSize: '11px', fontWeight: 700 }}>
                          <IonIcon icon={cellularOutline} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                          {device.rssi || -60} dBm
                        </IonBadge>

                        <IonButton
                          size="small"
                          color="success"
                          onClick={() => handleConnectDevice(device)}
                          disabled={isConnecting}
                          style={{ fontWeight: 700, margin: 0 }}
                        >
                          {isConnecting ? (