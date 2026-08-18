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
