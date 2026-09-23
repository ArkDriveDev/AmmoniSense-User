import React, { useEffect, useState, useCallback } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonBackButton,
  IonButtons, IonButton, IonIcon, IonSpinner, IonBadge, IonCard, IonCardContent
} from '@ionic/react';
import { addOutline, calendarOutline, pricetagOutline, locationOutline, chevronForwardOutline } from 'ionicons/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import { fetchSchedules } from '../../services/scheduleService';
import ScheduleCard from '../../components/inspection/ScheduleCard';
import CreateScheduleModal from '../../components/inspection/CreateScheduleModal';

export default function InspectionSiteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [site, setSite] = useState<any>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [tagCount, setTagCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [showCreateSchedule, setShowCreateSchedule] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const { data: siteData } = await supabase.from('inspection_sites').select('*').eq('id', id).maybeSingle();
      setSite(siteData);
      const [sched, tagRes] = await Promise.all([
        fetchSchedules(id),
        supabase.from('inspection_tags').select('id', { count: 'exact', head: true }).eq('inspection_site_id', id),
      ]);
      setSchedules(sched);
      setTagCount(tagRes.count ?? 0);
    } catch (err) {
      console.warn('[InspectionSiteDetail] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
    window.addEventListener('schedules_updated', fetchData);
    return () => window.removeEventListener('schedules_updated', fetchData);
  }, [fetchData]);

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar style={{ '--background': 'linear-gradient(135deg, #0F3C5C 0%, #1D5D9B 100%)', '--color': '#ffffff' }}>
          <IonButtons slot="start"><IonBackButton defaultHref="/inspection-sites" style={{ '--color': '#ffffff' }} /></IonButtons>
          <IonTitle style={{ fontWeight: 700 }}>{site?.site_name || 'Site Detail'}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => setShowCreateSchedule(true)} style={{ '--color': '#ffffff' }}>
              <IonIcon icon={addOutline} slot="start" /> Schedule
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
            {site && (
              <IonCard style={{ margin: '0 0 16px 0', borderRadius: '14px' }}>
                <IonCardContent style={{ padding: '16px' }}>
                  {site.site_photo_thumbnail && (
                    <img src={site.site_photo_thumbnail} alt="Site" style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: '10px', marginBottom: '12px' }} />
                  )}
                  <h2 style={{ margin: '0 0 4px 0', fontWeight: 800, fontSize: '20px', color: '#0F172A' }}>{site.site_name}</h2>
                  <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <IonIcon icon={locationOutline} color="primary" /> {site.address || 'No address'}
                  </p>
                  <IonBadge style={{ marginRight: '8px', background: '#EBF3FA', color: '#1D5D9B' }}>{site.site_type || 'Agricultural'}</IonBadge>
                  <div style={{ display: 'flex', gap: '16px', marginTop: '12px', fontSize: '13px', color: '#475569' }}>
                    <span><IonIcon icon={calendarOutline} color="primary" /> {schedules.length} Schedule{schedules.length !== 1 ? 's' : ''}</span>
                    <span><IonIcon icon={pricetagOutline} color="success" /> {tagCount} Tag{tagCount !== 1 ? 's' : ''}</span>
                  </div>
                </IonCardContent>
              </IonCard>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <h3 style={{ margin: 0, fontWeight: 700, fontSize: '16px', color: '#0F172A' }}>Inspection Schedules</h3>
              <IonButton size="small" fill="outline" onClick={() => setShowCreateSchedule(true)}>
                <IonIcon icon={addOutline} slot="start" /> New
              </IonButton>
            </div>

            {schedules.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: '#64748B' }}>
                <IonIcon icon={calendarOutline} style={{ fontSize: '48px', color: '#CBD5E1', display: 'block', margin: '0 auto 12px' }} />
                <p style={{ margin: 0, fontWeight: 600 }}>No schedules yet</p>
                <p style={{ margin: '4px 0 0 0', fontSize: '13px' }}>Tap "+ Schedule" to create the first visit</p>
              </div>
            ) : (
              schedules.map((s) => (
                <ScheduleCard key={s.id} schedule={s} onClick={() => navigate(`/schedules/${s.id}`)} />
              ))
            )}
          </>
        )}
        {id && (
          <CreateScheduleModal
            isOpen={showCreateSchedule}
            onClose={() => setShowCreateSchedule(false)}
            siteId={id}
            onCreated={fetchData}
          />
        )}
      </IonContent>
    </IonPage>
  );
}
