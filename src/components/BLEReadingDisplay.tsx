import React from 'react';
import {
  IonCard,
  IonCardContent,
  IonBadge,
  IonGrid,
  IonRow,
  IonCol,
  IonIcon
} from '@ionic/react';
import {
  flashOutline,
  thermometerOutline,
  waterOutline,
  wifiOutline,
  timeOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  warningOutline
} from 'ionicons/icons';
import { BLECentralReading } from '../services/bleCentralService';

interface BLEReadingDisplayProps {
  reading: BLECentralReading | null;
}

export const BLEReadingDisplay: React.FC<BLEReadingDisplayProps> = ({ reading }) => {
  if (!reading) {
    return (
      <IonCard className="premium-card" style={{ margin: '0 0 16px 0', padding: '24px', textAlign: 'center' }}>
        <IonCardContent>
          <IonIcon icon={wifiOutline} style={{ fontSize: '40px', color: '#94A3B8', marginBottom: '8px' }} />
          <h4 style={{ margin: '0 0 4px 0', color: '#0F172A', fontWeight: 700 }}>No Active Telemetry Stream</h4>
          <p style={{ margin: 0, color: '#64748B', fontSize: '13px' }}>
            Connect to a BLE sensor node to stream live 12-byte Float32 telemetry.