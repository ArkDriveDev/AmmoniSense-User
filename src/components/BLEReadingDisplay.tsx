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
          </p>
        </IonCardContent>
      </IonCard>
    );
  }

  const getAmmoniaSeverity = (nh3: number) => {
    if (nh3 > 20) return { label: 'CRITICAL HAZARD', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', icon: alertCircleOutline };
    if (nh3 > 10) return { label: 'HIGH WARNING', color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)', icon: warningOutline };
    if (nh3 > 5) return { label: 'MODERATE CAUTION', color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)', icon: warningOutline };
    return { label: 'NORMAL / SAFE', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)', icon: checkmarkCircleOutline };
  };

  const severity = getAmmoniaSeverity(reading.ammonia_ppm);

  return (
    <div style={{ marginBottom: '16px' }}>
      {/* Ammonia Gauge Card */}
      <IonCard
        className="premium-card"
        style={{
          margin: '0 0 12px 0',
          background: 'linear-gradient(135deg, rgba(15, 60, 92, 0.96), rgba(29, 93, 155, 0.92))',
          color: '#ffffff',
          borderRadius: '16px',