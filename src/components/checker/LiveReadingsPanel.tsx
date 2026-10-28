import React from 'react';
import { IonCard, IonCardContent, IonBadge, IonGrid, IonRow, IonCol, IonIcon } from '@ionic/react';
import { thermometerOutline, waterOutline, batteryChargingOutline, warningOutline, timeOutline } from 'ionicons/icons';
import { AmmoniSenseReading } from '../../types/schema';
import { calculateAmmoniaStatus } from '../../types/inspection';

interface Props {
  reading: AmmoniSenseReading | null;
  isConnected: boolean;
  isStale?: boolean;
  lastUpdate?: Date | null;
}

export const LiveReadingsPanel: React.FC<Props> = ({ reading, isConnected, isStale, lastUpdate }) => {
  const nh3 = reading?.nh3_ppm ?? null;
  const temp = reading?.temperature ?? null;
  const hum = reading?.humidity ?? null;
  const batt = reading?.battery_percent ?? null;

  const renderBadge = () => {
    if (nh3 === null || isNaN(nh3)) return null;
    const st = calculateAmmoniaStatus(nh3);
    if (st === 'NORMAL') return <IonBadge color="success" style={{ fontWeight: 800, padding: '6px 12px' }}>SAFE</IonBadge>;
    if (st === 'WARNING') return <IonBadge color="warning" style={{ fontWeight: 800, padding: '6px 12px' }}>WARNING</IonBadge>;
    return <IonBadge color="danger" style={{ fontWeight: 800, padding: '6px 12px' }}>CRITICAL</IonBadge>;
  };

  return (
    <div style={{ marginBottom: '16px', opacity: isConnected && isStale ? 0.5 : 1, transition: 'opacity 0.3s ease' }}>
      {isStale && isConnected && (
        <div style={{ marginBottom: '12px', padding: '8px 12px', borderRadius: '8px', background: '#FEF3C7', color: '#92400E', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <IonIcon icon={warningOutline} style={{ flexShrink: 0 }} />
          <span>No data — check connection.</span>
        </div>
      )}

      {/* Primary NH3 Card */}
      <IonCard className="premium-card" style={{ margin: '0 0 12px 0', background: 'linear-gradient(135deg, #0F3C5C 0%, #1D5D9B 100%)', color: '#fff', borderRadius: '14px', padding: '16px' }}>
        <IonCardContent style={{ padding: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.85, fontWeight: 700 }}>
                Ammonia Concentration (NH₃)
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginTop: '4px' }}>
                <span style={{ fontSize: '40px', fontWeight: 900, fontFamily: 'monospace' }}>
                  {typeof nh3 === 'number' && !isNaN(nh3) ? nh3.toFixed(2) : '—'}
                </span>
                <span style={{ fontSize: '18px', fontWeight: 700, opacity: 0.9 }}>ppm</span>
              </div>
            </div>
            <div>{renderBadge()}</div>
          </div>

          <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.15)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', opacity: 0.9 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <IonIcon icon={timeOutline} />
              {lastUpdate ? `Last update: ${lastUpdate.toTimeString().split(' ')[0]}` : 'Waiting for data…'}
            </span>
            <span>Classic SPP (Live)</span>
          </div>
        </IonCardContent>
      </IonCard>

      {/* Environmental & Battery Row */}
      <IonGrid style={{ padding: 0 }}>
        <IonRow>
          <IonCol size="4">
            <IonCard style={{ margin: 0, padding: '12px', textAlign: 'center', borderRadius: '12px', height: '100%' }}>
              <IonIcon icon={thermometerOutline} style={{ color: '#F97316', fontSize: '20px' }} />
              <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 700, marginTop: '2px' }}>TEMP</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', marginTop: '4px', fontFamily: 'monospace' }}>
                {typeof temp === 'number' && !isNaN(temp) ? `${temp.toFixed(1)}°C` : '—'}
              </div>
            </IonCard>
          </IonCol>
          <IonCol size="4">
            <IonCard style={{ margin: 0, padding: '12px', textAlign: 'center', borderRadius: '12px', height: '100%' }}>
              <IonIcon icon={waterOutline} style={{ color: '#3B82F6', fontSize: '20px' }} />
              <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 700, marginTop: '2px' }}>HUMIDITY</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', marginTop: '4px', fontFamily: 'monospace' }}>
                {typeof hum === 'number' && !isNaN(hum) ? `${hum.toFixed(1)}%` : '—'}
              </div>
            </IonCard>
          </IonCol>
          <IonCol size="4">
            <IonCard style={{ margin: 0, padding: '12px', textAlign: 'center', borderRadius: '12px', height: '100%' }}>
              <IonIcon icon={batteryChargingOutline} style={{ color: '#10B981', fontSize: '20px' }} />
              <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 700, marginTop: '2px' }}>BATTERY</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A', marginTop: '4px', fontFamily: 'monospace' }}>
                {typeof batt === 'number' && !isNaN(batt) ? `${batt}%` : '—'}
              </div>
            </IonCard>
          </IonCol>
        </IonRow>
      </IonGrid>
    </div>
  );
};

export default LiveReadingsPanel;
