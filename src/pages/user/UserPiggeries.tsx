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
  IonBadge
} from '@ionic/react';

import { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { refreshOutline, locationOutline } from 'ionicons/icons';
import { useNavigate } from 'react-router-dom';

export default function UserPiggeries() {
  const navigate = useNavigate();
  const [piggeries, setPiggeries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deviceCounts, setDeviceCounts] = useState<Record<number, number>>({});

  useEffect(() => {
    fetchPiggeries();
  }, []);

  const fetchPiggeries = async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      if (!userId) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('piggeries')
        .select(`
          *,
          clients!inner (profile_id)
        `)
        .eq('clients.profile_id', userId);

      if (error) {
        console.error('Error fetching piggeries:', error);
        return;
      }

      setPiggeries(data || []);

      const counts: Record<number, number> = {};
      for (const piggery of data || []) {
        const { count } = await supabase
          .from('devices')
          .select('id', { count: 'exact', head: true })
          .eq('piggery_id', piggery.id);
        counts[piggery.id] = count || 0;
      }
      setDeviceCounts(counts);
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async (event: CustomEvent) => {
    await fetchPiggeries();
    event.detail.complete();
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>My Piggeries</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={fetchPiggeries}>
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
            <p>Loading piggeries...</p>
          </div>
        ) : piggeries.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            <p>You don't have any piggeries yet.</p>
            <p style={{ fontSize: '14px', color: 'gray' }}>
              Contact your admin to assign piggeries to your account.
            </p>
          </div>
        ) : (
          <IonList>
            {piggeries.map((p) => (
              <IonItem key={p.id} detail button onClick={() => navigate(`/my-devices?piggery=${p.id}`)}>
                <IonLabel>
                  <h2>{p.piggery_name}</h2>
                  <p>
                    <IonIcon icon={locationOutline} style={{ marginRight: '4px' }} />
                    {p.location || 'No location set'}
                  </p>
                  <p>Serial: {p.piggery_serial}</p>
                </IonLabel>
                <IonBadge color="primary">
                  {deviceCounts[p.id] || 0} Devices
                </IonBadge>
              </IonItem>
            ))}
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
}