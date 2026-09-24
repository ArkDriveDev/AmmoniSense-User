import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonList,
  IonItem,
  IonLabel,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonButton,
  IonButtons,
  IonIcon,
  IonBadge,
  IonCard,
  IonCardContent
} from '@ionic/react';

import { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import offlineStorage from '../../services/OfflineStorageService';
import { deleteSite } from '../../services/siteService';
import PendingSyncBadge from '../../components/common/PendingSyncBadge';
import { OfflineSite } from '../../types/site';
import {
  refreshOutline,
  locationOutline,
  addOutline,
  businessOutline,
  hardwareChipOutline,
  chevronForwardOutline,
  createOutline,
  trashOutline
} from 'ionicons/icons';
import { useNavigate } from 'react-router-dom';
import CreateSiteModal from '../../components/sites/CreateSiteModal';
import SiteTypeBadge from '../../components/sites/SiteTypeBadge';

export default function UserSites() {
  const navigate = useNavigate();
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingSite, setEditingSite] = useState<any | null>(null);

  useEffect(() => {
    fetchSites();

    const handleSiteDeleted = () => {
      fetchSites();
    };

    window.addEventListener('site_deleted', handleSiteDeleted);
    window.addEventListener('site_synced', handleSiteDeleted);

    return () => {
      window.removeEventListener('site_deleted', handleSiteDeleted);
      window.removeEventListener('site_synced', handleSiteDeleted);
    };
  }, []);

  const fetchSites = async () => {
    setLoading(true);
    let onlineSitesList: any[] = [];

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      if (userId) {
          const { data, error } = await supabase
            .from('inspection_sites')
            .select('*')
            .eq('created_by', userId);

          if (!error && data) {
            onlineSitesList = data.map(l => ({
              id: l.id,
              site_name: l.site_name,
              location: l.address,
              address: l.address,
              site_code: l.site_code,
              site_type: l.site_type || 'Agricultural',
              area_size_hectares: l.area_size_hectares,
              current_latitude: l.current_latitude || l.latitude,
              current_longitude: l.current_longitude || l.longitude,
              notes: l.notes,
              site_photo_url: l.site_photo_url,
              site_photo_thumbnail: l.site_photo_thumbnail,
              isOffline: false,
            }));
          }
        }
    } catch (err) {
      console.warn('Network error or offline during fetchSites:', err);
    }

    // Load offline sites from IndexedDB
    try {
      const offlineRecords = await offlineStorage.getOfflineSites();
      const offlineSitesList = offlineRecords.map((os) => ({
        id: os.id,
        site_name: os.site_name,
        location: os.address,
        site_code: os.site_code,
        site_type: os.site_type || 'Agricultural',
        isOffline: true,
        is_pending_sync: true,
        offlineRecord: os,
      }));

      const combinedSites = [...offlineSitesList, ...onlineSitesList];
      setSites(combinedSites);
    } catch (err) {
      console.error('Unexpected error loading offline sites:', err);
      setSites(onlineSitesList);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSite = async (e: React.MouseEvent, siteId: string | number, siteName: string) => {
    e.stopPropagation();
    if (window.confirm(`Delete "${siteName}"?\n\nThis will permanently delete the site along with ALL its inspection schedules and tags.\nThis action cannot be undone.`)) {
      try {
        await deleteSite(siteId);
        await fetchSites();
      } catch (err: any) {
        alert(err.message || 'Failed to delete site.');
      }
    }
  };

  const handleEditSite = (e: React.MouseEvent, site: any) => {
    e.stopPropagation();
    setEditingSite(site.offlineRecord || site);
    setShowCreateModal(true);
  };

  const handleRefresh = async (event: CustomEvent) => {
    await fetchSites();
    event.detail.complete();
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar style={{ '--background': 'linear-gradient(135deg, #0F3C5C 0%, #1D5D9B 100%)', '--color': '#ffffff' }}>
          <IonTitle style={{ fontWeight: 700 }}>Inspection Sites</IonTitle>
          <IonButtons slot="end">
            <IonButton 
              onClick={() => setShowCreateModal(true)}
              style={{
                '--background': 'linear-gradient(135deg, #008B74 0%, #10A88F 100%)',
                '--color': '#ffffff',
                '--border-radius': '10px',
                fontWeight: 700,
                marginRight: '8px'
              }}
            >
              <IonIcon icon={addOutline} slot="start" />
              New Site
            </IonButton>
            <IonButton onClick={fetchSites} style={{ color: '#ffffff' }}>
              <IonIcon icon={refreshOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" style={{ '--background': '#F1F5F9' }}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {loading ? (
          <div style={{ textAlign: 'center', marginTop: '60px' }}>
            <IonSpinner name="crescent" color="primary" />
            <p style={{ color: '#64748B', fontWeight: 600, marginTop: '12px' }}>Loading inspection sites...</p>
          </div>
        ) : sites.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '60px' }}>
            <IonCard className="premium-card" style={{ maxWidth: '440px', margin: '0 auto', padding: '24px' }}>
              <IonCardContent>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  background: 'rgba(29, 93, 155, 0.1)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px'
                }}>
                  <IonIcon icon={businessOutline} style={{ fontSize: '32px', color: '#1D5D9B' }} />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: '0 0 8px 0' }}>No Sites Registered</h3>
                <p style={{ fontSize: '14px', color: '#64748B', margin: '0 0 20px 0' }}>
                  Register your first inspection site to start tracking ammonia levels.
                </p>
                <IonButton className="btn-ammoni btn-primary" expand="block" onClick={() => setShowCreateModal(true)}>
                  <IonIcon icon={addOutline} slot="start" />
                  Create Inspection Site
                </IonButton>
              </IonCardContent>
            </IonCard>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sites.map((s) => (
              <IonCard 
                key={s.id} 
                className="premium-card premium-card-accent" 
                style={{ margin: 0, cursor: 'pointer' }}
                onClick={() => !s.isOffline && navigate(`/inspection-sites/${s.id}`)}
              >
                <IonCardContent style={{ padding: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>{s.site_name}</h2>
                        <SiteTypeBadge siteType={s.site_type} />
                        {s.isOffline && <PendingSyncBadge />}
                      </div>

                      <p style={{ margin: '4px 0', fontSize: '13px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <IonIcon icon={locationOutline} style={{ color: '#1D5D9B' }} />
                        {s.location || 'No location address set'}
                      </p>

                      <div style={{ marginTop: '8px', fontSize: '12px', color: '#94A3B8', fontWeight: 600 }}>
                        Code: <span style={{ fontFamily: 'monospace', color: '#0F172A' }}>{s.site_code}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <IonButton
                          size="small"
                          fill="clear"
                          color="primary"
                          onClick={(e) => handleEditSite(e, s)}
                          title="Update site details"
                        >
                          <IonIcon icon={createOutline} slot="icon-only" />
                        </IonButton>
                        <IonButton
                          size="small"
                          fill="clear"
                          color="danger"
                          onClick={(e) => handleDeleteSite(e, s.id, s.site_name)}
                          title="Delete site"
                        >
                          <IonIcon icon={trashOutline} slot="icon-only" />
                        </IonButton>
                      </div>
                    </div>
                  </div>
                </IonCardContent>
              </IonCard>
            ))}
          </div>
        )}

        <CreateSiteModal
          isOpen={showCreateModal}
          onClose={() => {
            setShowCreateModal(false);
            setEditingSite(null);
          }}
          onSiteCreated={() => fetchSites()}
          editSite={editingSite}
        />
      </IonContent>
    </IonPage>
  );
}
