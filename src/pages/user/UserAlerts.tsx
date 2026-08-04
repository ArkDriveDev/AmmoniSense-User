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

import { useEffect, useState, useRef } from 'react';
import { supabase } from '../../services/supabase';
import { refreshOutline, checkmarkCircle } from 'ionicons/icons';

export default function UserAlerts() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const channelRef = useRef<any>(null);
  const isSubscribedRef = useRef(false);

  useEffect(() => {
    fetchAlerts();
    
    // Setup realtime after initial fetch
    const timer = setTimeout(() => {
      setupRealtimeSubscription();
    }, 500);

    return () => {
      clearTimeout(timer);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        isSubscribedRef.current = false;
      }
    };
  }, []);

  const setupRealtimeSubscription = () => {
    // Don't setup if already subscribed
    if (isSubscribedRef.current) {
      return;
    }

    // Remove existing channel if any
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Create new channel
    const channel = supabase.channel('user_alerts');
    
    // Add callback before subscribing
    channel.on(
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
    );

    // Then subscribe
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('Realtime subscription active for alerts');
        isSubscribedRef.current = true;
      }
    });

    channelRef.current = channel;
  };

  const fetchAlerts = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error('Auth error:', userError);
        setError('Authentication error');
        setLoading(false);
        return;
      }

      const userId = userData.user?.id;

      if (!userId) {
        setAlerts([]);
        setLoading(false);
        return;
      }

      // Query livestock_owners for user
      const { data: owners } = await supabase
        .from('livestock_owners')
        .select('id')
        .eq('created_by', userId);

      const ownerId = owners && owners.length > 0 ? owners[0].id : null;

      let livestockIds: any[] = [];
      if (ownerId) {
        const { data: livestock } = await supabase
          .from('livestock')
          .select('id')
          .eq('owner_id', ownerId);
        livestockIds = livestock?.map(l => l.id) || [];
      }

      if (livestockIds.length === 0) {
        setAlerts([]);
        setLoading(false);
        return;
      }

      const { data, error: alertError } = await supabase
        .from('sensor_data')
        .select('*')
        .or('status.eq.SEVERE,status.eq.MODERATE')
        .order('created_at', { ascending: false });

      if (alertError) {
        console.error('Error fetching sensor alerts:', alertError);
        setAlerts([]);
        setLoading(false);
        return;
      }

      setAlerts(data || []);
    } catch (err) {
      console.error('Unexpected error:', err);
      setError('An unexpected error occurred');
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
        setToastMessage('Failed to acknowledge alert');
        setShowToast(true);
        return;
      }

      setAlerts(prev => 
        prev.map(a => 
          a.id === id ? { ...a, acknowledged: true, is_read: true } : a
        )
      );
      
      setToastMessage('Alert acknowledged');
      setShowToast(true);
    } catch (err) {
      console.error('Unexpected error:', err);
      setToastMessage('An error occurred');
      setShowToast(true);
    }
  };

  const handleRefresh = async (event: CustomEvent) => {
    await fetchAlerts();
    event.detail.complete();
  };

  if (error) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>Alerts</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            <h3>Error Loading Alerts</h3>
            <p>{error}</p>
            <IonButton onClick={fetchAlerts}>Try Again</IonButton>
          </div>
        </IonContent>
      </IonPage>
    );
  }

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
          <div style={{ textAlign: 'center', marginTop: '40px' }}>
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
                    {a.severity || 'Unknown'} Alert
                  </h2>
                  <p>Ammonia: {a.ammonia || 0} ppm</p>
                  <p>Device: {a.device_uid || 'Unknown'}</p>
                  <p style={{ fontSize: '12px', color: 'gray' }}>
                    {a.created_at ? new Date(a.created_at).toLocaleString() : 'Unknown time'}
                  </p>
                </IonLabel>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                  <IonBadge color={a.severity === 'SEVERE' ? 'danger' : a.severity === 'MODERATE' ? 'warning' : 'success'}>
                    {a.severity || 'Unknown'}
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
          duration={3000}
          color={toastMessage.includes('Failed') || toastMessage.includes('error') ? 'danger' : 'success'}
          position="bottom"
        />
      </IonContent>
    </IonPage>
  );
}