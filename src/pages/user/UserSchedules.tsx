import React, { useEffect, useState, useCallback } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonRefresher, IonRefresherContent, IonIcon, IonSpinner, IonSelect, IonSelectOption, IonItem, IonLabel
} from '@ionic/react';
import { calendarOutline } from 'ionicons/icons';
import { useNavigate } from 'react-router-dom';
import { fetchSchedules } from '../../services/scheduleService';
import { supabase } from '../../services/supabase';
import ScheduleCard from '../../components/inspection/ScheduleCard';
import { InspectionSchedule } from '../../types/inspection';

export default function UserSchedules() {
  const navigate = useNavigate();
  const [schedules, setSchedules] = useState<InspectionSchedule[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [filterSite, setFilterSite] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sched, siteRes] = await Promise.all([
        fetchSchedules(filterSite || undefined),
        supabase.from('inspection_sites').select('id, site_name'),
      ]);
      setSchedules(sched);
      if (siteRes.data) setSites(siteRes.data);
    } catch (err) {
      console.warn('[UserSchedules] load error:', err);
    } finally {
      setLoading(false);
    }
  }, [filterSite]);

  useEffect(() => {
    load();
    window.addEventListener('schedules_updated', load);
    return () => window.removeEventListener('schedules_updated', load);
  }, [load]);

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar style={{ '--background': 'linear-gradient(135deg, #0F3C5C 0%, #1D5D9B 100%)', '--color': '#ffffff' }}>
          <IonTitle style={{ fontWeight: 700 }}>Inspection Schedules</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding" style={{ '--background': '#F1F5F9' }}>
        <IonRefresher slot="fixed" onIonRefresh={async (e) => { await load(); e.detail.complete(); }}>
          <IonRefresherContent />
        </IonRefresher>
        {sites.length > 0 && (
          <IonItem style={{ marginBottom: '12px', '--background': 'white', borderRadius: '10px' }}>
            <IonLabel>Filter by Site</IonLabel>
            <IonSelect value={filterSite} onIonChange={(e) => setFilterSite(e.detail.value)} placeholder="All Sites">
              <IonSelectOption value="">All Sites</IonSelectOption>
              {sites.map((s) => <IonSelectOption key={s.id} value={s.id}>{s.site_name}</IonSelectOption>)}
            </IonSelect>
          </IonItem>
        )}
        {loading ? (
          <div style={{ textAlign: 'center', marginTop: '60px' }}>
            <IonSpinner name="crescent" color="primary" />
          </div>
        ) : schedules.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '60px', color: '#64748B' }}>
            <IonIcon icon={calendarOutline} style={{ fontSize: '64px', color: '#CBD5E1', display: 'block', margin: '0 auto 12px' }} />
            <h3 style={{ margin: '0 0 8px' }}>No Schedules Yet</h3>
            <p style={{ fontSize: '14px', color: '#94A3B8' }}>Go to an Inspection Site and create a new schedule.</p>
          </div>
        ) : (
          schedules.map((s) => (
            <ScheduleCard key={s.id} schedule={s} tagCount={s.tags_count} onClick={() => navigate(`/schedules/${s.id}`)} />
          ))
        )}
      </IonContent>
    </IonPage>
  );
}
