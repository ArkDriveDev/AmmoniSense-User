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
  IonBadge,
  IonButton,
  IonButtons,
  IonIcon,
  IonChip
} from '@ionic/react';

import { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { refreshOutline, hardwareChipOutline } from 'ionicons/icons';
import { useLocation, useNavigate } from 'react-router-dom';

export default function UserDevices() {
  const navigate = useNavigate();
  const location = useLocation();
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [piggeryName, setPiggeryName] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const piggeryId = params.get('piggery');
    fetchDevices(piggeryId);
  }, [location]);

  const fetchDevices = async (piggeryId: string | null) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      if (!userId) {
        setLoading(false);
        return;
      }

      let query = supabase
        .from('devices')
        .select(`
          *,
          piggeries!inner (
            id,
            piggery_name,
            clients!inner (profile_id)
          )
        `)
        .eq('piggeries.clients.profile_id', userId);

      if (piggeryId) {
        query = query.eq('piggery_id', parseInt(piggeryId));
        
        const { data: piggery } = await supabase
          .from('piggeries')
          .select('piggery_name')
          .eq('id', parseInt(piggeryId))
          .single();
        setPiggeryName(piggery?.piggery_name || '');
      }

      const { data, error } = await query;

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
    await fetchDevices(params.get('piggery'));
    event.detail.complete();
  };

  const getStatusColor = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'ACTIVE': return 'success';
      case 'INACTIVE': return 'danger';
      case 'PENDING': return 'warning';
      default: return 'medium';
    }
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{piggeryName ? `${piggeryName} - Devices` : 'My Devices'}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => {
              const params = new URLSearchParams(location.search);
              fetchDevices(params.get('piggery'));
            }}>
              <IonIcon icon={refreshOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {loading ? (
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <IonSpinner />
            <p>Loading devices...</p>
          </div>
        ) : devices.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            <IonIcon icon={hardwareChipOutline} size="large" style={{ fontSize: '48px', color: 'gray' }} />
            <p>No devices found.</p>
            <p style={{ fontSize: '14px', color: 'gray' }}>
              Devices will appear here once they are registered.
            </p>
          </div>
        ) : (
          <IonList>
            {devices.map((d) => (
              <IonItem key={d.id}>
                <IonLabel>
                  <h2>{d.device_uid}</h2>
                  <p>Firmware: {d.firmware_version || 'Unknown'}</p>
                  <p>Installed: {new Date(d.installed_at).toLocaleDateString()}</p>
                  {d.last_seen && (
                    <p style={{ fontSize: '12px', color: 'gray' }}>
                      Last seen: {new Date(d.last_seen).toLocaleString()}
                    </p>
                  )}
                </IonLabel>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <IonBadge color={getStatusColor(d.status)}>
                    {d.status || 'Unknown'}
                  </IonBadge>
                  {d.last_seen && (
                    <IonChip color={new Date().getTime() - new Date(d.last_seen).getTime() < 60000 ? 'success' : 'warning'}>
                      <IonLabel>
                        {new Date().getTime() - new Date(d.last_seen).getTime() < 60000 ? 'Online' : 'Offline'}
                      </IonLabel>
                    </IonChip>
                  )}
                </div>
              </IonItem>
            ))}
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
}