import React, { useState } from 'react';
import { IonCard, IonCardContent, IonBadge, IonIcon, IonButton } from '@ionic/react';
import { calendarOutline, timeOutline, chevronForwardOutline, cloudOfflineOutline, pricetagOutline, checkmarkDoneOutline, trashOutline, createOutline } from 'ionicons/icons';
import { InspectionSchedule } from '../../types/inspection';
import { updateSchedule, deleteSchedule } from '../../services/scheduleService';
import CreateScheduleModal from './CreateScheduleModal';
import { showToast } from '../../utils/toast';
import { formatTime12h } from '../../utils/timeUtils';

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

export const ScheduleCard: React.FC<Props> = ({ schedule, tagCount, onClick }) => {
  const [completing, setCompleting] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  const handleMarkCompleted = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (completing || schedule.status === 'COMPLETED') return;
    setCompleting(true);
    try {
      await updateSchedule(schedule.id, { status: 'COMPLETED' });
      ['schedules_updated', 'sync_queue_changed'].forEach((ev) => window.dispatchEvent(new CustomEvent(ev)));
      showToast({ message: 'Schedule marked as completed', color: 'success' });
    } catch (err: any) {
      showToast({ message: err?.message || 'Failed to update schedule', color: 'danger' });
    } finally { setCompleting(false); }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (schedule.confirmed) {
      showToast({ message: 'Cannot modify a confirmed schedule.', color: 'danger' });
      return;
    }
    if (!window.confirm(`Delete schedule "${schedule.schedule_name}" and all its inspection tags?`)) return;
    try {
      await deleteSchedule(schedule.id);
      showToast({ message: 'Schedule deleted', color: 'success' });
    } catch (err: any) {
      showToast({ message: err?.message || 'Failed to delete schedule', color: 'danger' });
    }
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (schedule.confirmed) {
      showToast({ message: 'Cannot modify a confirmed schedule.', color: 'danger' });
      return;
    }
    setShowEdit(true);
  };

  return (
  <IonCard button={!!onClick} onClick={onClick} style={{ margin: '8px 0', borderRadius: '12px' }}>
    <IonCardContent style={{ padding: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 160px', minWidth: 0 }}>
          <h3 style={{ margin: '0 0 6px 0', fontWeight: 700, fontSize: '16px', color: '#0F172A', whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere', lineHeight: 1.3 }}>
            {schedule.schedule_name}
          </h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: '#64748B', flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <IonIcon icon={calendarOutline} /> {schedule.scheduled_date}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <IonIcon icon={timeOutline} /> {formatTime12h(schedule.scheduled_time) || '09:00 AM'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
          <IonBadge color={statusColor(schedule.status)}>{schedule.status}</IonBadge>
          {schedule.status === 'COMPLETED' && (
            <IonBadge color={schedule.confirmed ? 'success' : 'medium'} style={{ fontSize: '12px' }}>
              {schedule.confirmed ? 'Confirmed' : 'Pending confirmation'}
            </IonBadge>
          )}
          {schedule.isOffline && (
            <IonBadge color="warning" style={{ fontSize: '12px' }}>
              <IonIcon icon={cloudOfflineOutline} style={{ marginRight: '3px' }} /> Offline — not synced
            </IonBadge>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #F1F5F9', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <IonIcon icon={pricetagOutline} color="primary" /> {tagCount ?? schedule.tags_count ?? 0} Tag{(tagCount ?? schedule.tags_count ?? 0) === 1 ? '' : 's'}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {schedule.status !== 'COMPLETED' && (
            <IonButton size="small" color="success" disabled={completing} onClick={handleMarkCompleted} style={{ '--border-radius': '8px', fontSize: '12px', minHeight: '40px', margin: 0 }}>
              <IonIcon icon={checkmarkDoneOutline} slot="start" /> Mark as Completed
            </IonButton>
          )}
          {!schedule.confirmed && (
            <>
              <IonButton size="small" fill="clear" color="primary" onClick={handleEdit} style={{ margin: 0, minWidth: '40px', minHeight: '40px' }} title="Update schedule">
                <IonIcon icon={createOutline} slot="icon-only" />
              </IonButton>
              <IonButton size="small" fill="clear" color="danger" onClick={handleDelete} style={{ margin: 0, minWidth: '40px', minHeight: '40px' }} title="Delete schedule">
                <IonIcon icon={trashOutline} slot="icon-only" />
              </IonButton>
            </>
          )}
          <IonIcon icon={chevronForwardOutline} color="medium" />
        </div>
      </div>
    </IonCardContent>
    <CreateScheduleModal
      isOpen={showEdit}
      onClose={() => setShowEdit(false)}
      siteId={schedule.inspection_site_id}
      editSchedule={schedule}
    />
  </IonCard>
  );
};
export default ScheduleCard;
