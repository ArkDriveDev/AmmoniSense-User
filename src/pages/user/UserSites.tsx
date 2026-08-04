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
        .from('livestock_owners')
        .select('id')
        .eq('created_by', userId);

      const ownerId = owners && owners.length > 0 ? owners[0].id : null;

      let livestockList: any[] = [];
      if (ownerId) {
        const { data, error } = await supabase
          .from('livestock')
          .select('*')
          .eq('owner_id', ownerId);

        if (!error && data) {
          livestockList = data.map(l => ({
            id: l.id,
            site_name: l.livestock_name,
            location: l.address,
            site_serial: l.livestock_serial
          }));
        }
      }

      setSites(livestockList);

      const counts: Record<number, number> = {};
      for (const item of livestockList) {
        const { count } = await supabase
          .from('devices')
          .select('id', { count: 'exact', head: true })
          .eq('livestock_id', item.id);
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

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Monitoring Sites</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={fetchSites}>
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
            <p>Loading monitoring sites...</p>
          </div>
        ) : sites.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            <p>No monitoring sites assigned yet.</p>
            <p style={{ fontSize: '14px', color: 'gray' }}>
              Contact MENRO Admin to assign monitoring sites to your account.
            </p>
          </div>
        ) : (
          <IonList>
            {sites.map((s) => (
              <IonItem key={s.id} detail button onClick={() => navigate(`/devices?site=${s.id}`)}>
                <IonLabel>
                  <h2>{s.site_name}</h2>
                  <p>
                    <IonIcon icon={locationOutline} style={{ marginRight: '4px' }} />
                    {s.location || 'No location set'}
                  </p>
                  <p>Serial: {s.site_serial}</p>
                </IonLabel>
                <IonBadge color="primary">
                  {deviceCounts[s.id] || 0} Devices
                </IonBadge>
              </IonItem>
            ))}
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
}
