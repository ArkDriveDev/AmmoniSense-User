import React from 'react';
import { IonCard, IonCardContent, IonBadge, IonIcon } from '@ionic/react';
import { calendarOutline, timeOutline, chevronForwardOutline, cloudOfflineOutline, pricetagOutline } from 'ionicons/icons';
import { InspectionSchedule } from '../../types/inspection';

interface Props {
  schedule: InspectionSchedule;
  tagCount?: number;
  onClick?: () => void;
}

const statusColor = (s: string) => {
  switch (s) {
    case 'COMPLETED': return 'success';
    case 'IN_PROGRESS': return 'warning';
    case 'CANCELLED': return 'danger';
    default: return 'medium';
  }
};

export const ScheduleCard: React.FC<Props> = ({ schedule, tagCount, onClick }) => (
  <IonCard button={!!onClick} onClick={onClick} style={{ margin: '8px 0', borderRadius: '12px' }}>
    <IonCardContent style={{ padding: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h3 style={{ margin: '0 0 6px 0', fontWeight: 700, fontSize: '16px', color: '#0F172A' }}>
            {schedule.schedule_name}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: '#64748B' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <IonIcon icon={calendarOutline} /> {schedule.scheduled_date}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <IonIcon icon={timeOutline} /> {schedule.scheduled_time || '09:00'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          <IonBadge color={statusColor(schedule.status)}>{schedule.status}</IonBadge>
          {schedule.isOffline && (
            <IonBadge color="warning" style={{ fontSize: '10px' }}>
              <IonIcon icon={cloudOfflineOutline} style={{ marginRight: '3px' }} /> Offline
            </IonBadge>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #F1F5F9' }}>
        <span style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <IonIcon icon={pricetagOutline} color="primary" /> {tagCount ?? schedule.tags_count ?? 0} Tag{(tagCount ?? schedule.tags_count ?? 0) === 1 ? '' : 's'}
        </span>
        <IonIcon icon={chevronForwardOutline} color="medium" />
      </div>
    </IonCardContent>
  </IonCard>
);
export default ScheduleCard;
