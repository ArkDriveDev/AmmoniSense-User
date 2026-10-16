import React from 'react';
import { IonCard, IonCardContent, IonBadge, IonIcon } from '@ionic/react';
import { checkmarkCircleOutline } from 'ionicons/icons';
import { CaptureSummary } from '../../types/capture';

interface Props {
  summary: CaptureSummary;
  onContinue?: () => void;
}

export const CaptureSummaryView: React.FC<Props> = ({ summary }) => {
  return (
    <IonCard style={{ margin: '14px 0', borderRadius: '12px', border: '1px solid #10B981' }}>
      <IonCardContent style={{ padding: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <IonIcon icon={checkmarkCircleOutline} color="success" style={{ fontSize: '20px' }} />
            Capture Completed
          </span>
          <IonBadge color="success">{summary.total_readings} Readings Saved</IonBadge>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', textAlign: 'center', margin: '12px 0' }}>
          <div style={{ background: '#F8FAFC', padding: '10px 4px', borderRadius: '8px' }}>
            <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 700 }}>MAX PPM</div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#EF4444' }}>{summary.max_ppm}</div>
          </div>
          <div style={{ background: '#F8FAFC', padding: '10px 4px', borderRadius: '8px' }}>
            <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 700 }}>AVG PPM</div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#2563EB' }}>{summary.avg_ppm}</div>
          </div>
          <div style={{ background: '#F8FAFC', padding: '10px 4px', borderRadius: '8px' }}>
            <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 700 }}>MIN PPM</div>
            <div style={{ fontSize: '16px', fontWeight: 800, color: '#10B981' }}>{summary.min_ppm}</div>
          </div>
        </div>
      </IonCardContent>
    </IonCard>
  );
};

export default CaptureSummaryView;
