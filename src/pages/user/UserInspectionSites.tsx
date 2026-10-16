import React, { useEffect, useState, useCallback } from 'react';
import {
  IonPage, IonHeader, IonToolbar, IonTitle, IonContent,
  IonRefresher, IonRefresherContent, IonButton, IonButtons,
  IonIcon, IonBadge, IonSpinner, IonCard, IonCardContent
} from '@ionic/react';
import {
  addOutline, refreshOutline, businessOutline, locationOutline,
  chevronForwardOutline, calendarOutline, pricetagOutline
} from 'ionicons/icons';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../services/supabase';
import offlineStorage from '../../services/OfflineStorageService';
import { fetchSites as loadAllSites } from '../../services/siteService';
import CreateSiteModal from '../../components/sites/CreateSiteModal';
import PendingSyncBadge from '../../components/common/PendingSyncBadge';
import SiteTypeBadge from '../../components/sites/SiteTypeBadge';
import { getPoultryTypeLabel, getChickenTypeLabel } from '../../constants/siteTypes';

export default function UserInspectionSites() {
  const navigate = useNavigate();
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, { schedules: number; tags: number }>>({});
  const [showCreate, setShowCreate] = useState(false);

  const fetchSites = useCallback(async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      const allSites = await loadAllSites(userId);
      setSites(allSites);

      const countsMap: Record<string, { schedules: number; tags: number }> = {};
      const offlineSchedules = offlineStorage.getOfflineSchedules();
      const offlineTags = offlineStorage.getOfflineTags();

      for (const s of allSites) {
        let schedCount = offlineSchedules.filter((os: any) => String(os.inspection_site_id) === String(s.id)).length;
        let tagCount = offlineTags.filter((ot: any) => String(ot.inspection_site_id) === String(s.id)).length;
        if (!s.isOffline && navigator.onLine) {
          try {
            const [schedRes, tagRes] = await Promise.all([
              supabase.from('inspection_schedules').select('id', { count: 'exact', head: true }).eq('inspection_site_id', s.id),
              supabase.from('inspection_tags').select('id', { count: 'exact', head: true }).eq('inspection_site_id', s.id),
            ]);
            schedCount += schedRes.count ?? 0;
            tagCount += tagRes.count ?? 0;
          } catch {}
        }
        countsMap[s.id] = { schedules: schedCount, tags: tagCount };
      }
      setCounts(countsMap);
    } catch {
      const fallback = await loadAllSites();
      setSites(fallback);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSites();
    window.addEventListener('site_synced', fetchSites);
    window.addEventListener('site_deleted', fetchSites);
    return () => {
      window.removeEventListener('site_synced', fetchSites);
      window.removeEventListener('site_deleted', fetchSites);
    };
  }, [fetchSites]);

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar style={{ '--background': 'linear-gradient(135deg, #0F3C5C 0%, #1D5D9B 100%)', '--color': '#ffffff' }}>
          <IonTitle style={{ fontWeight: 700 }}>Inspection Sites</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => setShowCreate(true)} style={{ '--color': '#ffffff' }}>
              <IonIcon icon={addOutline} slot="start" /> New Site
            </IonButton>
            <IonButton onClick={fetchSites} style={{ '--color': '#ffffff' }}><IonIcon icon={refreshOutline} /></IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding" style={{ '--background': '#F1F5F9' }}>
        <IonRefresher slot="fixed" onIonRefresh={async (e) => { await fetchSites(); e.detail.complete(); }}>
          <IonRefresherContent />
        </IonRefresher>
        {loading ? (
          <div style={{ textAlign: 'center', marginTop: '60px' }}>
            <IonSpinner name="crescent" color="primary" />
            <p style={{ color: '#64748B', fontWeight: 600, marginTop: '12px' }}>Loading inspection sites...</p>
          </div>
        ) : sites.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '60px' }}>
            <IonIcon icon={businessOutline} style={{ fontSize: '64px', color: '#CBD5E1' }} />
            <h3 style={{ color: '#64748B', margin: '16px 0 8px' }}>
              {!navigator.onLine ? 'No sites available offline. Connect to sync.' : 'No Inspection Sites Yet'}
            </h3>
            <p style={{ color: '#94A3B8', marginBottom: '20px', fontSize: '14px' }}>
              {!navigator.onLine ? 'Inspection sites will appear here once synchronized.' : 'Register your first site to begin scheduling inspections.'}
            </p>
            <IonButton expand="block" onClick={() => setShowCreate(true)}>
              <IonIcon icon={addOutline} slot="start" /> Create Inspection Site
            </IonButton>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {sites.map((s) => (
              <IonCard key={s.id} button onClick={() => navigate(`/inspection-sites/${s.id}`)} style={{ margin: 0, borderRadius: '14px' }}>
                <IonCardContent style={{ padding: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0F172A' }}>{s.site_name}</h2>
                        {s.isOffline && <PendingSyncBadge />}
                        <SiteTypeBadge siteType={s.site_type} />
                        {s.poultry_type && (
                          <span style={{ fontSize: '11px', fontWeight: 700, background: '#F1F5F9', color: '#1E293B', padding: '3px 8px', borderRadius: '6px' }}>
                            {getPoultryTypeLabel(s.poultry_type)}
                          </span>
                        )}
                        {s.chicken_type && (
                          <span style={{ fontSize: '11px', fontWeight: 700, background: '#F1F5F9', color: '#1E293B', padding: '3px 8px', borderRadius: '6px' }}>
                            {getChickenTypeLabel(s.chicken_type)}
                          </span>
                        )}
                      </div>
                      <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <IonIcon icon={locationOutline} color="primary" />
                        {s.address || s.location || 'No address'}
                      </p>
                    </div>
                    <IonIcon icon={chevronForwardOutline} color="medium" />
                  </div>
                  {!s.isOffline && counts[s.id] && (
                    <div style={{ display: 'flex', gap: '12px', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #F1F5F9' }}>
                      <span style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <IonIcon icon={calendarOutline} color="primary" /> {counts[s.id].schedules} Schedule{counts[s.id].schedules !== 1 ? 's' : ''}
                      </span>
                      <span style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <IonIcon icon={pricetagOutline} color="success" /> {counts[s.id].tags} Tag{counts[s.id].tags !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </IonCardContent>
              </IonCard>
            ))}
          </div>
        )}
        <CreateSiteModal isOpen={showCreate} onClose={() => setShowCreate(false)} onSiteCreated={fetchSites} editSite={null} />
      </IonContent>
    </IonPage>
  );
}
