import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonBadge,
  IonButton,
  IonButtons,
  IonIcon,
  IonCard,
  IonCardContent
} from '@ionic/react';

import { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { refreshOutline, hardwareChipOutline, wifiOutline, timeOutline } from 'ionicons/icons';
import { useLocation } from 'react-router-dom';

export default function UserDevices() {
  const location = useLocation();
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [siteName, setSiteName] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const siteId = params.get('site') || params.get('piggery');
    fetchDevices(siteId);
  }, [location]);

  const fetchDevices = async (siteId: string | null) => {
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

      let siteQuery = supabase
        .from('monitoring_sites')
        .select('id, site_name');

      if (ownerId) {
        siteQuery = siteQuery.eq('owner_id', ownerId);
      }
      if (siteId) {
        siteQuery = siteQuery.eq('id', parseInt(siteId));
      }

      const { data: siteList } = await siteQuery;

      if (siteId && siteList && siteList.length > 0) {
        setSiteName(siteList[0].site_name);
      }

      const siteIds = siteList?.map(s => s.id) || [];

      let deviceQuery = supabase.from('devices').select('*');
      if (siteIds.length > 0) {
        deviceQuery = deviceQuery.in('site_id', siteIds);
      }

      const { data, error } = await deviceQuery;

      if (error) {
        console.error('Error fetching devices:', error);
        return;
      }

      setDevices(data || []);
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async (event: CustomEvent) => {
    const params = new URLSearchParams(location.search);
    await fetchDevices(params.get('site') || params.get('piggery'));
    event.detail.complete();
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar style={{ '--background': 'linear-gradient(135deg, #0F3C5C 0%, #1D5D9B 100%)', '--color': '#ffffff' }}>
          <IonTitle style={{ fontWeight: 700 }}>{siteName ? `${siteName} — Devices` : 'Environmental Devices'}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => {
              const params = new URLSearchParams(location.search);
              fetchDevices(params.get('site') || params.get('piggery'));
            }} style={{ color: '#ffffff' }}>
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
            <p style={{ color: '#64748B', fontWeight: 600, marginTop: '12px' }}>Loading registered devices...</p>
          </div>
        ) : devices.length === 0 ? (
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
                  <IonIcon icon={hardwareChipOutline} style={{ fontSize: '32px', color: '#1D5D9B' }} />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: '0 0 8px 0' }}>No Devices Found</h3>
                <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>
                  Devices will automatically appear here once paired and deployed at monitoring sites.
                </p>
              </IonCardContent>
            </IonCard>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {devices.map((d) => {
              const isOnline = d.last_seen && (new Date().getTime() - new Date(d.last_seen).getTime() < 60000);
              return (
                <IonCard key={d.id} className="premium-card" style={{ margin: 0 }}>
                  <IonCardContent style={{ padding: '18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                          <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '12px',
                            background: isOnline ? 'rgba(5, 150, 105, 0.12)' : 'rgba(100, 116, 139, 0.12)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <IonIcon icon={hardwareChipOutline} style={{ color: isOnline ? '#059669' : '#64748B', fontSize: '20px' }} />
                          </div>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0F172A', fontFamily: 'monospace' }}>
                              {d.device_uid}
                            </h3>
                            <span style={{ fontSize: '12px', color: '#64748B' }}>
                              Firmware v{d.firmware_version || '1.0.0'}
                            </span>
                          </div>
                        </div>

                        <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px' }}>
                          <IonIcon icon={timeOutline} style={{ color: '#94A3B8' }} />
                          Installed: {new Date(d.installed_at).toLocaleDateString()}
                          {d.last_seen && (
                            <span style={{ color: '#475569' }}>
                              • Last seen: {new Date(d.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                        <span className={`status-badge ${isOnline ? 'safe' : 'offline'}`}>
                          <span className="pulse-dot"></span>
                          {isOnline ? 'Online' : 'Offline'}
                        </span>
                        <IonBadge style={{ background: '#E2E8F0', color: '#475569', fontSize: '10px', fontWeight: 700 }}>
                          {d.status || 'ACTIVE'}
                        </IonBadge>
                      </div>
                    </div>
                  </IonCardContent>
                </IonCard>
              );
            })}
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}