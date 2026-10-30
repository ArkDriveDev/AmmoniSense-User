import React, { useEffect, useState, useCallback } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonBackButton,
  IonButtons, IonButton, IonIcon, IonSpinner, IonBadge, IonCard, IonCardContent,
  IonSegment, IonSegmentButton, IonLabel
} from '@ionic/react';
import {
  addOutline, calendarOutline, timeOutline, pricetagOutline,
  mapOutline, listOutline, syncOutline, trashOutline, createOutline, checkmarkDoneOutline
} from 'ionicons/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { fetchScheduleById, deleteSchedule, updateSchedule } from '../../services/scheduleService';
import { showToast } from '../../utils/toast';
import offlineStorage from '../../services/OfflineStorageService';
import { fetchTags } from '../../services/tagService';
import TagList from '../../components/inspection/TagList';
import AddTagModal from '../../components/inspection/AddTagModal';
import EditTagModal from '../../components/inspection/EditTagModal';
import CreateScheduleModal from '../../components/inspection/CreateScheduleModal';
import ScheduleTagsMap from '../../components/inspection/ScheduleTagsMap';
import syncService from '../../services/SyncService';
import { InspectionSchedule, InspectionTag } from '../../types/inspection';
import { formatTime12h } from '../../utils/timeUtils';

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
  const [showEditSchedule, setShowEditSchedule] = useState(false);
  const [editingTag, setEditingTag] = useState<InspectionTag | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [resyncing, setResyncing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const sched = await fetchScheduleById(id);
      setSchedule(sched);
      const schedTempId = sched?.offline_temp_id || (String(id).startsWith('temp_') ? String(id) : undefined);
      const tagList = await fetchTags({
        scheduleId: sched?.id || id,
        scheduleTempId: schedTempId,
      });
      setTags(tagList);
    } catch (err) {
      console.warn('[ScheduleDetail] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const handleResync = async () => {
    setResyncing(true);
    try {
      await syncService.resync();
      await load();
    } finally {
      setResyncing(false);
    }
  };

  const handleDeleteSchedule = async () => {
    if (!schedule) return;
    const isOffline = String(schedule.id).startsWith('temp_') || (schedule as any).isOffline;
    const confirmed = window.confirm(
      isOffline
        ? 'Delete this schedule and all its offline tags and readings? This cannot be undone.'
        : `Delete "${schedule.schedule_name}"?\n\nThis will permanently delete the schedule and ALL its inspection tags.\nThis action cannot be undone.`
    );
    if (!confirmed) return;
    setDeleting(true);
    try {
      if (isOffline) {
        await offlineStorage.deleteScheduleAndChildren(String(schedule.id));
      } else {
        await deleteSchedule(schedule.id);
      }
      navigate(-1);
    } catch (err: any) {
      alert(err.message || 'Failed to delete schedule.');
    } finally {
      setDeleting(false);
    }
  };

  const loadRef = React.useRef(load);
  loadRef.current = load;

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const handler = () => { loadRef.current(); };
    window.addEventListener('tags_updated', handler);
    window.addEventListener('schedules_updated', handler);
    window.addEventListener('sync_queue_changed', handler);
    return () => {
      window.removeEventListener('tags_updated', handler);
      window.removeEventListener('schedules_updated', handler);
      window.removeEventListener('sync_queue_changed', handler);
    };
  }, []);

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar style={{ '--background': 'linear-gradient(135deg, #0F3C5C 0%, #1D5D9B 100%)', '--color': '#ffffff' }}>
          <IonButtons slot="start"><IonBackButton defaultHref="/schedules" style={{ '--color': '#ffffff' }} /></IonButtons>
          <IonTitle style={{ fontWeight: 700 }}>{schedule?.schedule_name || 'Schedule'}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => setShowEditSchedule(true)} style={{ '--color': '#ffffff' }} title="Update schedule">
              <IonIcon icon={createOutline} slot="icon-only" />
            </IonButton>
            <IonButton onClick={handleDeleteSchedule} disabled={deleting} style={{ '--color': '#ff6b6b' }} title="Delete schedule">
              <IonIcon icon={trashOutline} slot="icon-only" />
            </IonButton>
            <IonButton onClick={handleResync} disabled={resyncing} style={{ '--color': '#ffffff' }} title="Re-sync data">
              <IonIcon icon={syncOutline} slot="icon-only" style={{ animation: resyncing ? 'spin 1.2s linear infinite' : 'none' }} />
            </IonButton>
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
                        <span><IonIcon icon={timeOutline} /> {formatTime12h(schedule.scheduled_time) || '09:00 AM'}</span>
                      </div>

                      {schedule.site_name && (
                        <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94A3B8' }}>Site: {schedule.site_name}</p>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                      <IonBadge color={statusColor(schedule.status)}>{schedule.status}</IonBadge>
                      {schedule.status === 'COMPLETED' && (
                        <IonBadge color={schedule.confirmed ? 'success' : 'medium'} style={{ fontSize: '10px' }}>
                          {schedule.confirmed ? 'Confirmed' : 'Pending confirmation'}
                        </IonBadge>
                      )}
                    </div>
                  </div>
                  {schedule.notes && (
                    <p style={{ margin: '10px 0 0 0', fontSize: '13px', color: '#475569', background: '#F8FAFC', padding: '8px', borderRadius: '8px' }}>{schedule.notes}</p>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #F1F5F9', fontSize: '13px', flexWrap: 'wrap', gap: '8px' }}>
                    <span style={{ color: '#475569' }}><IonIcon icon={pricetagOutline} color="primary" /> {tags.length} Tag{tags.length !== 1 ? 's' : ''}</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {schedule.status !== 'COMPLETED' && (
                        <IonButton
                          size="small"
                          color="success"
                          onClick={async () => {
                            await updateSchedule(schedule.id, { status: 'COMPLETED' });
                            window.dispatchEvent(new CustomEvent('schedules_updated'));
                            window.dispatchEvent(new CustomEvent('sync_queue_changed'));
                            showToast({ message: 'Schedule marked as completed', color: 'success' });
                          }}
                          style={{ '--border-radius': '8px', fontSize: '12px', height: '30px' }}
                        >
                          <IonIcon icon={checkmarkDoneOutline} slot="start" /> Mark as Completed
                        </IonButton>
                      )}
                      <IonButton
                        size="small"
                        fill="outline"
                        color="primary"
                        onClick={() => setShowEditSchedule(true)}
                        style={{ '--border-radius': '8px', fontSize: '12px', height: '30px' }}
                      >
                        <IonIcon icon={createOutline} slot="start" /> Update Details
                      </IonButton>
                    </div>
                  </div>
                </IonCardContent>
              </IonCard>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: '16px', color: '#0F172A' }}>Inspection Tags</h3>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <IonSegment
                  value={viewMode}
                  onIonChange={(e) => setViewMode((e.detail.value as 'list' | 'map') || 'list')}
                  style={{ width: '150px', height: '32px' }}
                >
                  <IonSegmentButton value="list" style={{ minHeight: '32px', fontSize: '12px' }}>
                    <IonIcon icon={listOutline} style={{ fontSize: '13px', marginRight: '3px' }} />
                    <IonLabel>List</IonLabel>
                  </IonSegmentButton>
                  <IonSegmentButton value="map" style={{ minHeight: '32px', fontSize: '12px' }}>
                    <IonIcon icon={mapOutline} style={{ fontSize: '13px', marginRight: '3px' }} />
                    <IonLabel>Map</IonLabel>
                  </IonSegmentButton>
                </IonSegment>
                <IonButton size="small" color="success" onClick={() => setShowAddTag(true)}>
                  <IonIcon icon={addOutline} slot="start" /> Add Tag
                </IonButton>
              </div>
            </div>

            {viewMode === 'map' ? (
              <ScheduleTagsMap tags={tags} height="360px" />
            ) : (
              <TagList tags={tags} onEditTag={(tag) => setEditingTag(tag)} onDeleteTag={(tag) => setEditingTag(tag)} />
            )}
          </>
        )}

        {schedule && (
          <CreateScheduleModal
            isOpen={showEditSchedule}
            onClose={() => setShowEditSchedule(false)}
            siteId={schedule.inspection_site_id}
            editSchedule={schedule}
            onCreated={load}
          />
        )}

        {editingTag && (
          <EditTagModal
            isOpen={!!editingTag}
            onClose={() => setEditingTag(null)}
            tag={editingTag}
            onUpdated={load}
            onDeleted={load}
          />
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
