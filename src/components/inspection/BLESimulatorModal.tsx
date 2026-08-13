import React, { useState } from 'react';
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
  IonItem,
  IonLabel,
  IonRange,
  IonIcon,
  IonBadge,
  IonGrid,
  IonRow,
  IonCol
} from '@ionic/react';
import {
  bluetoothOutline,
  closeOutline,
  radioOutline,
  flashOutline,
  alertCircleOutline,
  checkmarkCircleOutline,
  warningOutline,
  refreshOutline
} from 'ionicons/icons';
import bleService, { BLEReading } from '../../services/bleService';

interface BLESimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSimulatedReading?: (reading: BLEReading) => void;
}

export const BLESimulatorModal: React.FC<BLESimulatorModalProps> = ({
  isOpen,
  onClose,
  onSimulatedReading
}) => {
  const [deviceUid, setDeviceUid] = useState<string>('ESP32-AMMONIA-NODE-01');
  const [ammonia, setAmmonia] = useState<number>(24.5);
  const [temperature, setTemperature] = useState<number>(28.5);
  const [humidity, setHumidity] = useState<number>(68.0);
  const [battery, setBattery] = useState<number>(92);
  const [rssi, setRssi] = useState<number>(-62);
  const [isBroadcasting, setIsBroadcasting] = useState<boolean>(false);

  const applyPreset = (preset: 'normal' | 'moderate' | 'hazard') => {
    if (preset === 'normal') {
      setAmmonia(3.2);
      setTemperature(27.0);
      setHumidity(58.0);
      setBattery(98);
    } else if (preset === 'moderate') {
      setAmmonia(14.8);
      setTemperature(29.5);
      setHumidity(70.0);
      setBattery(85);
    } else if (preset === 'hazard') {
      setAmmonia(54.2);
      setTemperature(33.5);
      setHumidity(82.0);
      setBattery(74);
    }
  };

  const handleBroadcast = () => {
    setIsBroadcasting(true);
    const reading: BLEReading = {
      device_uid: deviceUid,
      ammonia: parseFloat(ammonia.toFixed(1)),
      temperature: parseFloat(temperature.toFixed(1)),
      humidity: parseFloat(humidity.toFixed(1)),
      battery,
      rssi,
      timestamp: new Date().toISOString()
    };

    bleService.broadcastTelemetry(reading);
    if (onSimulatedReading) {
      onSimulatedReading(reading);
    }

    setTimeout(() => {
      setIsBroadcasting(false);
    }, 400);
  };

  const getAmmoniaSeverity = (nh3: number) => {
    if (nh3 > 20) return { label: 'CRITICAL HAZARD', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' };
    if (nh3 > 10) return { label: 'HIGH WARNING', color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)' };
    if (nh3 > 5) return { label: 'MODERATE CAUTION', color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)' };
    return { label: 'NORMAL / SAFE', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)' };
  };

  const severity = getAmmoniaSeverity(ammonia);

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      <IonHeader className="ion-no-border">
        <IonToolbar style={{ '--background': 'linear-gradient(135deg, #0F3C5C 0%, #1D5D9B 100%)', '--color': '#ffffff' }}>
          <IonTitle style={{ fontWeight: 700, fontSize: '16px' }}>
            <IonIcon icon={bluetoothOutline} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
            ESP32 BLE Hardware Simulator
          </IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose} style={{ color: '#ffffff' }}>
              <IonIcon icon={closeOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" style={{ '--background': '#F8FAFC' }}>
        {/* Glassmorphism Header Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(15, 60, 92, 0.95), rgba(29, 93, 155, 0.9))',
            borderRadius: '16px',
            padding: '18px',
            color: '#ffffff',
            marginBottom: '20px',
            boxShadow: '0 8px 24px rgba(15, 60, 92, 0.25)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.15)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8 }}>
                SIMULATED BLE TRANSMITTER
              </span>
              <h3 style={{ margin: '4px 0 0 0', fontWeight: 800, fontSize: '18px' }}>{deviceUid}</h3>
            </div>
            <IonBadge style={{ background: severity.bg, color: severity.color, padding: '6px 12px', fontSize: '11px', fontWeight: 700 }}>
              {severity.label}
            </IonBadge>
          </div>
        </div>

        {/* Quick Presets */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Telemetry Presets
          </label>
          <IonGrid style={{ padding: 0, marginTop: '8px' }}>
            <IonRow>
              <IonCol size="4">
                <IonButton
                  expand="block"
                  fill="outline"
                  color="success"
                  size="small"
                  onClick={() => applyPreset('normal')}
                  style={{ fontWeight: 600 }}
                >
                  <IonIcon icon={checkmarkCircleOutline} slot="start" />
                  Safe (3.2 ppm)
                </IonButton>
              </IonCol>
              <IonCol size="4">
                <IonButton
                  expand="block"
                  fill="outline"
                  color="warning"
                  size="small"
                  onClick={() => applyPreset('moderate')}
                  style={{ fontWeight: 600 }}
                >
                  <IonIcon icon={warningOutline} slot="start" />
                  Warn (14.8)
                </IonButton>
              </IonCol>
              <IonCol size="4">
                <IonButton
                  expand="block"
                  fill="outline"
                  color="danger"
                  size="small"
                  onClick={() => applyPreset('hazard')}
                  style={{ fontWeight: 600 }}
                >
                  <IonIcon icon={alertCircleOutline} slot="start" />
                  Hazard (54.2)
                </IonButton>
              </IonCol>
            </IonRow>
          </IonGrid>
        </div>

        {/* Live Telemetry Sliders */}
        <IonCard className="premium-card" style={{ margin: '0 0 20px 0' }}>
          <IonCardContent style={{ padding: '16px' }}>
            {/* Ammonia Slider */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontWeight: 700, fontSize: '14px', color: '#0F172A' }}>Ammonia Concentration (NH₃)</span>
                <IonBadge style={{ background: severity.color, fontSize: '13px', fontWeight: 800 }}>
                  {ammonia.toFixed(1)} ppm
                </IonBadge>
              </div>
              <IonRange
                min={0}
                max={100}
                step={0.5}
                value={ammonia}
                onIonChange={(e) => setAmmonia(e.detail.value as number)}
                style={{ '--bar-background-active': severity.color }}
              />
            </div>

            {/* Temperature Slider */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, fontSize: '13px', color: '#475569' }}>Temperature</span>
                <span style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>{temperature.toFixed(1)} °C</span>
              </div>
              <IonRange
                min={15}
                max={45}
                step={0.5}
                value={temperature}
                onIonChange={(e) => setTemperature(e.detail.value as number)}
              />
            </div>

            {/* Humidity Slider */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, fontSize: '13px', color: '#475569' }}>Humidity</span>
                <span style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>{humidity.toFixed(1)} %</span>
              </div>
              <IonRange
                min={20}
                max={100}
                step={1}
                value={humidity}
                onIonChange={(e) => setHumidity(e.detail.value as number)}
              />
            </div>

            {/* Battery Slider */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, fontSize: '13px', color: '#475569' }}>Sensor Node Battery</span>
                <span style={{ fontWeight: 700, fontSize: '13px', color: '#0F172A' }}>{battery} %</span>
              </div>
              <IonRange
                min={10}
                max={100}
                step={1}
                value={battery}
                onIonChange={(e) => setBattery(e.detail.value as number)}
              />
            </div>
          </IonCardContent>
        </IonCard>

        {/* Broadcast Action Button */}
        <IonButton
          expand="block"
          color="primary"
          size="large"
          onClick={handleBroadcast}
          disabled={isBroadcasting}
          style={{ fontWeight: 700 }}
        >
          <IonIcon icon={radioOutline} slot="start" />
          {isBroadcasting ? 'Broadcasting BLE Packet...' : 'Broadcast BLE Stream to Form'}
        </IonButton>
      </IonContent>
    </IonModal>
  );
};

export default BLESimulatorModal;
