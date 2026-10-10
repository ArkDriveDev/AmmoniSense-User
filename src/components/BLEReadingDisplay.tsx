import React from 'react';
import {
  IonCard,
  IonCardContent,
  IonBadge,
  IonGrid,
  IonRow,
  IonCol,
  IonIcon,
  IonSpinner
} from '@ionic/react';
import {
  thermometerOutline,
  waterOutline,
  batteryChargingOutline,
  wifiOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  warningOutline,
  timeOutline
} from 'ionicons/icons';
import { AmmoniSenseReading } from '../types/schema';
import { usePpmConfirmation } from '../hooks/usePpmConfirmation';

interface BLEReadingDisplayProps {
  reading: AmmoniSenseReading | null;
  isConnected?: boolean;
}

export const BLEReadingDisplay: React.FC<BLEReadingDisplayProps> = ({
  reading,
  isConnected = true,
}) => {
  const ppmVal = reading ? reading.nh3_ppm : null;
  const { status: ppmStatus, badgeLabel, badgeColor } = usePpmConfirmation(ppmVal, isConnected);

  if (!reading) {
    return (
      <IonCard className="premium-card" style={{ margin: '0 0 16px 0', padding: '24px', textAlign: 'center' }}>
        <IonCardContent>
          <IonIcon icon={wifiOutline} style={{ fontSize: '40px', color: '#94A3B8', marginBottom: '8px' }} />
          <h4 style={{ margin: '0 0 4px 0', color: '#0F172A', fontWeight: 700 }}>No Active Telemetry Stream</h4>
          <p style={{ margin: 0, color: '#64748B', fontSize: '13px' }}>
            Connect to AmmoniSense sensor via Classic Bluetooth SPP to stream live readings.
          </p>
        </IonCardContent>
      </IonCard>
    );
  }

  const getAmmoniaSeverity = (nh3: number | null) => {
    if (nh3 === null) return { label: 'UNKNOWN', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', icon: alertCircleOutline };
    if (nh3 > 20) return { label: 'CRITICAL HAZARD', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', icon: alertCircleOutline };
    if (nh3 > 10) return { label: 'HIGH WARNING', color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)', icon: warningOutline };
    if (nh3 > 5) return { label: 'MODERATE CAUTION', color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)', icon: warningOutline };
    return { label: 'NORMAL / SAFE', color: '#22c55e', bg: 'rgba(34, 197, 94, 0.15)', icon: checkmarkCircleOutline };
  };

  const severity = getAmmoniaSeverity(reading.nh3_ppm);

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
                  {typeof reading.nh3_ppm === 'number' && !isNaN(reading.nh3_ppm) ? reading.nh3_ppm.toFixed(2) : '—'}
                </span>
                <span style={{ fontSize: '18px', fontWeight: 700, opacity: 0.9 }}>PPM</span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
              <IonBadge style={{ background: severity.bg, color: severity.color, padding: '8px 14px', borderRadius: '20px', fontSize: '11px', fontWeight: 800 }}>
                <IonIcon icon={severity.icon} style={{ verticalAlign: 'middle', marginRight: '4px', fontSize: '14px' }} />
                {severity.label}
              </IonBadge>

              {/* 10-Second Confirmation Window Badge */}
              {badgeLabel && (
                <IonBadge
                  color={badgeColor}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '16px',
                    fontSize: '11px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  {ppmStatus === 'confirming' ? (
                    <IonSpinner name="dots" style={{ width: '14px', height: '14px' }} />
                  ) : (
                    <IonIcon icon={checkmarkCircleOutline} style={{ fontSize: '14px' }} />
                  )}
                  {badgeLabel}
                </IonBadge>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.15)', fontSize: '12px', opacity: 0.9 }}>
            <div>
              <b>Sensor:</b> AmmoniSense
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="pulse-dot"></span>
              Classic SPP Stream (Every ~2s)
            </div>
          </div>
        </IonCardContent>
      </IonCard>

      {/* Environmental Metrics (Temp, Humidity, Battery %) */}
      <IonGrid style={{ padding: 0 }}>
        <IonRow>
          {/* Temperature */}
          <IonCol size="4">
            <IonCard className="premium-card" style={{ margin: 0, padding: '14px', height: '100%' }}>
              <IonCardContent style={{ padding: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <IonIcon icon={thermometerOutline} style={{ color: '#F97316', fontSize: '18px' }} />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B' }}>TEMP</span>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>
                  {typeof reading.temperature === 'number' && !isNaN(reading.temperature) ? `${reading.temperature.toFixed(1)}°C` : '—'}
                </div>
              </IonCardContent>
            </IonCard>
          </IonCol>

          {/* Humidity */}
          <IonCol size="4">
            <IonCard className="premium-card" style={{ margin: 0, padding: '14px', height: '100%' }}>
              <IonCardContent style={{ padding: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <IonIcon icon={waterOutline} style={{ color: '#3B82F6', fontSize: '18px' }} />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B' }}>HUMIDITY</span>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>
                  {typeof reading.humidity === 'number' && !isNaN(reading.humidity) ? `${reading.humidity.toFixed(1)}%` : '—'}
                </div>
              </IonCardContent>
            </IonCard>
          </IonCol>

          {/* Battery */}
          <IonCol size="4">
            <IonCard className="premium-card" style={{ margin: 0, padding: '14px', height: '100%' }}>
              <IonCardContent style={{ padding: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                  <IonIcon icon={batteryChargingOutline} style={{ color: '#10B981', fontSize: '18px' }} />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748B' }}>BATTERY</span>
                </div>
                <div style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', fontFamily: 'monospace' }}>
                  {typeof reading.battery_percent === 'number' && !isNaN(reading.battery_percent) ? `${reading.battery_percent}%` : '—'}
                </div>
                {typeof reading.battery_voltage === 'number' && !isNaN(reading.battery_voltage) && (
                  <div style={{ fontSize: '10px', color: '#64748B', marginTop: '2px' }}>
                    {reading.battery_voltage.toFixed(2)} V
                  </div>
                )}
              </IonCardContent>
            </IonCard>
          </IonCol>
        </IonRow>
      </IonGrid>
    </div>
  );
};

export default BLEReadingDisplay;
