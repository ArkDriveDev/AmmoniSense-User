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
import { refreshOutline, locationOutline, addOutline, businessOutline, hardwareChipOutline, chevronForwardOutline } from 'ionicons/icons';
import { useNavigate } from 'react-router-dom';
import CreateSiteModal from '../../components/sites/CreateSiteModal';

export default function UserSites() {
  const navigate = useNavigate();
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deviceCounts, setDeviceCounts] = useState<Record<number, number>>({});

  useEffect(() => {
    fetchSites();
  }, []);

  const fetchSites = async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      if (!userId) {
        setLoading(false);
        return;
      }

      const { data: owners } = await supabase
        .from('site_owners')
        .select('id')
        .eq('created_by', userId);

      const ownerId = owners && owners.length > 0 ? owners[0].id : null;

      let sitesList: any[] = [];
      if (ownerId) {
        const { data, error } = await supabase
          .from('monitoring_sites')
          .select('*')
          .eq('owner_id', ownerId);

        if (!error && data) {
          sitesList = data.map(l => ({
            id: l.id,
            site_name: l.site_name,
            location: l.address,
            site_code: l.site_code,
            site_type: l.site_type || 'Agricultural'
          }));
        }
      }

      setSites(sitesList);

      const counts: Record<number, number> = {};
      for (const item of sitesList) {
        const { count } = await supabase
          .from('devices')
          .select('id', { count: 'exact', head: true })
          .eq('site_id', item.id);
        counts[item.id] = count || 0;
      }
      setDeviceCounts(counts);
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async (event: CustomEvent) => {
    await fetchSites();
    event.detail.complete();
  };

  const [showCreateModal, setShowCreateModal] = useState(false);

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
                  <IonIcon icon={businessOutline} style={{ fontSize: '32px', color: '#1D5D9B' }} />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: '0 0 8px 0' }}>No Sites Registered</h3>
                <p style={{ fontSize: '14px', color: '#64748B', margin: '0 0 20px 0' }}>
                  Register your first environmental monitoring site to start tracking ammonia levels.
                </p>
                <IonButton className="btn-ammoni btn-primary" expand="block" onClick={() => setShowCreateModal(true)}>
                  <IonIcon icon={addOutline} slot="start" />
                  Create Monitoring Site
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
                onClick={() => navigate(`/devices?site=${s.id}`)}
              >
                <IonCardContent style={{ padding: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>{s.site_name}</h2>
                        <IonBadge style={{ background: '#EBF3FA', color: '#1D5D9B', borderRadius: '6px', fontSize: '11px', fontWeight: 700 }}>
                          {s.site_type}
                        </IonBadge>
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
                      <IonBadge style={{ background: 'linear-gradient(135deg, #1D5D9B 0%, #0F3C5C 100%)', color: '#ffffff', padding: '6px 12px', borderRadius: '20px', fontWeight: 700 }}>
                        <IonIcon icon={hardwareChipOutline} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                        {deviceCounts[s.id] || 0} Devices
                      </IonBadge>
                      <IonIcon icon={chevronForwardOutline} style={{ color: '#94A3B8', fontSize: '20px' }} />
                    </div>
                  </div>
                </IonCardContent>
              </IonCard>
            ))}
          </div>
        )}

        <CreateSiteModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSiteCreated={() => fetchSites()}
        />
      </IonContent>
    </IonPage>
  );
}
