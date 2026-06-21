import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonList,
  IonItem,
  IonLabel,
  IonBadge,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonButton,
  IonButtons,
  IonIcon,
  IonToast
} from '@ionic/react';

import { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { refreshOutline, checkmarkCircle } from 'ionicons/icons';

export default function UserAlerts() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  useEffect(() => {
    fetchAlerts();

    const subscription = supabase
      .channel('user_alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'alerts'
        },
        (payload) => {
          setAlerts(prev => [payload.new, ...prev]);
          setToastMessage(`New alert: Ammonia ${payload.new.ammonia} ppm`);
          setShowToast(true);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchAlerts = async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      if (!userId) {
        setAlerts([]);
        setLoading(false);
        return;
      }

      const { data: piggeries } = await supabase
        .from('piggeries')
        .select('id')
        .eq('clients.profile_id', userId);

      const piggeryIds = piggeries?.map(p => p.id) || [];

      if (piggeryIds.length === 0) {
        setAlerts([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .in('piggery_id', piggeryIds)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching alerts:', error);
        return;
      }

      setAlerts(data || []);
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  const acknowledgeAlert = async (id: number) => {
    try {
      const { error } = await supabase
        .from('alerts')
        .update({ acknowledged: true, is_read: true })
        .eq('id', id);

      if (error) {
        console.error('Error acknowledging alert:', error);
        return;
      }

      setAlerts(prev => 
        prev.map(a => 
          a.id === id ? { ...a, acknowledged: true, is_read: true } : a
        )
      );
    } catch (err) {
      console.error('Unexpected error:', err);
    }
  };

  const handleRefresh = async (event: CustomEvent) => {
    await fetchAlerts();
    event.detail.complete();
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Alerts</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={fetchAlerts}>
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
            <p>Loading alerts...</p>
          </div>
        ) : alerts.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            <p style={{ fontSize: '18px' }}>No alerts</p>
            <p style={{ fontSize: '14px', color: 'gray' }}>
              All your piggeries are safe.
            </p>
          </div>
        ) : (
          <IonList>
            {alerts.map((a) => (
              <IonItem key={a.id}>
                <IonLabel>
                  <h2 style={{ color: a.severity === 'SEVERE' ? 'red' : 'orange' }}>
                    {a.severity} Alert
                  </h2>
                  <p>Ammonia: {a.ammonia} ppm</p>
                  <p>Device: {a.device_uid || 'Unknown'}</p>
                  <p style={{ fontSize: '12px', color: 'gray' }}>
                    {new Date(a.created_at).toLocaleString()}
                  </p>
                </IonLabel>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <IonBadge color={a.severity === 'SEVERE' ? 'danger' : 'warning'}>
                    {a.severity}
                  </IonBadge>
                  {a.acknowledged ? (
                    <IonBadge color="success">Acknowledged</IonBadge>
                  ) : (
                    <IonButton 
                      size="small" 
                      color="primary"
                      onClick={() => acknowledgeAlert(a.id)}
                    >
                      <IonIcon icon={checkmarkCircle} />
                      &nbsp;Acknowledge
                    </IonButton>
                  )}
                </div>
              </IonItem>
            ))}
          </IonList>
        )}

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMessage}
          duration={5000}
          color="danger"
          position="top"
        />
      </IonContent>
    </IonPage>
  );
}