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

export default function UserSites() {
  const navigate = useNavigate();
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deviceCounts, setDeviceCounts] = useState<Record<string | number, number>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingOfflineSite, setEditingOfflineSite] = useState<OfflineSite | null>(null);

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
        const { data: owners } = await supabase
          .from('site_owners')
          .select('id')
          .eq('created_by', userId);

        const ownerId = owners && owners.length > 0 ? owners[0].id : null;

        if (ownerId) {
          const { data, error } = await supabase
            .from('monitoring_sites')
            .select('*')
            .eq('owner_id', ownerId);

          if (!error && data) {
            onlineSitesList = data.map(l => ({
              id: l.id,
              site_name: l.site_name,
              location: l.address,
              site_code: l.site_code,
              site_type: l.site_type || 'Agricultural',
              isOffline: false,
            }));
          }
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

      const counts: Record<string | number, number> = {};
      for (const item of onlineSitesList) {
        try {
          const { count } = await supabase
            .from('devices')
            .select('id', { count: 'exact', head: true })
            .eq('site_id', item.id);
          counts[item.id] = count || 0;
        } catch {}
      }
      setDeviceCounts(counts);
    } catch (err) {
      console.error('Unexpected error loading offline sites:', err);
      setSites(onlineSitesList);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSite = async (e: React.MouseEvent, siteId: string | number, siteName: string) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete monitoring site "${siteName}"?`)) {
      try {
        await deleteSite(siteId);
        await fetchSites();
      } catch (err: any) {
        alert(err.message || 'Failed to delete site.');
      }
    }
  };

  const handleEditOfflineSite = (e: React.MouseEvent, site: OfflineSite) => {
    e.stopPropagation();
    setEditingOfflineSite(site);
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
          <IonTitle style={{ fontWeight: 700 }}>Monitoring Sites</IonTitle>
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
            <p style={{ color: '#64748B', fontWeight: 600, marginTop: '12px' }}>Loading monitoring sites...</p>
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