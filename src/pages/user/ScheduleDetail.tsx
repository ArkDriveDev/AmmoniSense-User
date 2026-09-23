import React, { useEffect, useState, useCallback } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonBackButton,
  IonButtons, IonButton, IonIcon, IonSpinner, IonBadge, IonCard, IonCardContent
} from '@ionic/react';
import { addOutline, calendarOutline, timeOutline, pricetagOutline, personOutline } from 'ionicons/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchScheduleById } from '../../services/scheduleService';
import { fetchTags } from '../../services/tagService';
import TagList from '../../components/inspection/TagList';
import AddTagModal from '../../components/inspection/AddTagModal';
import { InspectionSchedule, InspectionTag } from '../../types/inspection';

const statusColor = (s: string) => {
  if (s === 'COMPLETED') return 'success';
  if (s === 'IN_PROGRESS') return 'warning';
  if (s === 'CANCELLED') return 'danger';
  return 'medium';
};

export default function ScheduleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [schedule, setSchedule] = useState<InspectionSchedule | null>(null);
  const [tags, setTags] = useState<InspectionTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddTag, setShowAddTag] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [sched, tagList] = await Promise.all([
        fetchScheduleById(id),
        fetchTags({ scheduleId: id }),
      ]);
      setSchedule(sched);
      setTags(tagList);
    } catch (err) {
      console.warn('[ScheduleDetail] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
    window.addEventListener('tags_updated', load);
    return () => window.removeEventListener('tags_updated', load);
  }, [load]);

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar style={{ '--background': 'linear-gradient(135deg, #0F3C5C 0%, #1D5D9B 100%)', '--color': '#ffffff' }}>
          <IonButtons slot="start"><IonBackButton defaultHref="/schedules" style={{ '--color': '#ffffff' }} /></IonButtons>
          <IonTitle style={{ fontWeight: 700 }}>{schedule?.schedule_name || 'Schedule'}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => setShowAddTag(true)} style={{ '--color': '#ffffff' }}>
              <IonIcon icon={addOutline} slot="start" /> Add Tag
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding" style={{ '--background': '#F1F5F9' }}>
        {loading ? (
          <div style={{ textAlign: 'center', marginTop: '60px' }}>
            <IonSpinner name="crescent" color="primary" />
          </div>
        ) : (
          <>
            {schedule && (
              <IonCard style={{ margin: '0 0 16px 0', borderRadius: '14px' }}>
                <IonCardContent style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h2 style={{ margin: '0 0 6px 0', fontWeight: 800, fontSize: '18px', color: '#0F172A' }}>{schedule.schedule_name}</h2>
                      <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: '#64748B', flexWrap: 'wrap' }}>
                        <span><IonIcon icon={calendarOutline} /> {schedule.scheduled_date}</span>
                        <span><IonIcon icon={timeOutline} /> {schedule.scheduled_time || '09:00'}</span>
                      </div>
                      {schedule.assigned_to && (
                        <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <IonIcon icon={personOutline} /> {schedule.assigned_to}
                        </p>
                      )}
                      {schedule.site_name && (
                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>Site: {schedule.site_name}</p>
                      )}
                    </div>
                    <div>
                      <IonBadge color={statusColor(schedule.status)}>{schedule.status}</IonBadge>
                    </div>
                  </div>
                  {schedule.notes && (
                    <p style={{ margin: '10px 0 0 0', fontSize: '13px', color: '#475569', background: '#F8FAFC', padding: '8px', borderRadius: '8px' }}>{schedule.notes}</p>
                  )}
                  <div style={{ display: 'flex', gap: '12px', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #F1F5F9', fontSize: '13px' }}>
                    <span style={{ color: '#475569' }}><IonIcon icon={pricetagOutline} color="primary" /> {tags.length} Tag{tags.length !== 1 ? 's' : ''}</span>
                  </div>
                </IonCardContent>
              </IonCard>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: '16px', color: '#0F172A' }}>Inspection Tags</h3>
              <IonButton size="small" color="success" onClick={() => setShowAddTag(true)}>
                <IonIcon icon={addOutline} slot="start" /> Add Tag
              </IonButton>
            </div>

            <TagList tags={tags} />
          </>
        )}

        {schedule && (
          <AddTagModal
            isOpen={showAddTag}
            onClose={() => setShowAddTag(false)}
            scheduleId={schedule.id}
            siteId={schedule.inspection_site_id}
            onCreated={load}
          />
        )}
      </IonContent>
    </IonPage>
  );
}
