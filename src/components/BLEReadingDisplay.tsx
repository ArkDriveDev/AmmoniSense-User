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
          padding: '18px',
          boxShadow: '0 8px 24px rgba(15, 60, 92, 0.25)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.15)'
        }}
      >
        <IonCardContent style={{ padding: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8, fontWeight: 700 }}>
                AMMONIA CONCENTRATION (NH₃)
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                <span style={{ fontSize: '42px', fontWeight: 900, fontFamily: 'monospace', letterSpacing: '-1px' }}>
                  {reading.ammonia_ppm.toFixed(2)}
                </span>
                <span style={{ fontSize: '18px', fontWeight: 700, opacity: 0.9 }}>PPM</span>
              </div>
            </div>

            <IonBadge style={{ background: severity.bg, color: severity.color, padding: '8px 14px', borderRadius: '20px', fontSize: '11px', fontWeight: 800 }}>
              <IonIcon icon={severity.icon} style={{ verticalAlign: 'middle', marginRight: '4px', fontSize: '14px' }} />
              {severity.label}
            </IonBadge>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.15)', fontSize: '12px', opacity: 0.9 }}>
            <div>
              <b>Node:</b> {reading.device_name || reading.device_id}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="pulse-dot"></span>
              GATT 12-Byte Float32 Notification
            </div>
          </div>
        </IonCardContent>
      </IonCard>

      {/* Environmental Metrics (Temp & Humidity & Battery) */}
      <IonGrid style={{ padding: 0 }}>
        <IonRow>
          {/* Temperature */}
          <IonCol size="6">
            <IonCard className="premium-card" style={{ margin: 0, padding: '14px' }}>
              <IonCardContent style={{ padding: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <IonIcon icon={thermometerOutline} style={{ color: '#F97316', fontSize: '18px' }} />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B' }}>TEMPERATURE</span>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>
                  {reading.temperature_c.toFixed(1)} <span style={{ fontSize: '14px' }}>°C</span>
                </div>
              </IonCardContent>
            </IonCard>
          </IonCol>

          {/* Humidity */}
          <IonCol size="6">
            <IonCard className="premium-card" style={{ margin: 0, padding: '14px' }}>
              <IonCardContent style={{ padding: 0 }}>