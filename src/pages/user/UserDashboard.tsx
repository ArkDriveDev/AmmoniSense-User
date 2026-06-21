import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardContent,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonButton,
  IonButtons,
  IonIcon,
  IonChip,
  IonLabel
} from '@ionic/react';

import { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { refreshOutline, alertCircle } from 'ionicons/icons';
import { useNavigate } from 'react-router-dom';

export default function UserDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    piggeryCount: 0,
    deviceCount: 0,
    totalDevices: 0,
    activeDevices: 0,
    alertCount: 0,
    latestAmmonia: 0,
    averageAmmonia: 0
  });

  useEffect(() => {
    fetchDashboardData();
    
    const subscription = supabase
      .channel('user_dashboard')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'sensor_data' 
        },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      if (!userId) {
        setLoading(false);
        return;
      }

      // Get client
      const { data: clients } = await supabase
        .from('clients')
        .select('id')
        .eq('profile_id', userId);

      if (!clients || clients.length === 0) {
        setLoading(false);
        return;
      }

      const client = clients[0];

      // Get piggeries
      const { data: piggeries } = await supabase
        .from('piggeries')
        .select('id, piggery_name, location, piggery_serial')
        .eq('client_id', client.id);

      const piggeryIds = piggeries?.map(p => p.id) || [];

      // Get devices
      const { data: devices } = await supabase
        .from('devices')
        .select('*')
        .in('piggery_id', piggeryIds);

      // Get sensor data
      const deviceUids = devices?.map(d => d.device_uid) || [];
      let sensorData: any[] = [];
      if (deviceUids.length > 0) {
        const { data } = await supabase
          .from('sensor_data')
          .select('*')
          .in('device_uid', deviceUids)
          .order('created_at', { ascending: false })
          .limit(10);
        sensorData = data || [];
      }

      // Get alert count
      let alertCount = 0;
      if (piggeryIds.length > 0) {
        const { count } = await supabase
          .from('alerts')
          .select('id', { count: 'exact', head: true })
          .in('piggery_id', piggeryIds)
          .eq('is_read', false);
        alertCount = count || 0;
      }

      const activeDevices = devices?.filter(d => d.status === 'ACTIVE') || [];
      const avgAmmonia = sensorData.reduce((sum, d) => sum + (d.ammonia || 0), 0) / (sensorData.length || 1);

      setStats({
        piggeryCount: piggeries?.length || 0,
        deviceCount: devices?.length || 0,
        totalDevices: devices?.length || 0,
        activeDevices: activeDevices.length,
        alertCount: alertCount,
        latestAmmonia: sensorData[0]?.ammonia || 0,
        averageAmmonia: avgAmmonia || 0
      });
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async (event: CustomEvent) => {
    await fetchDashboardData();
    event.detail.complete();
  };

  if (loading) {
    return (
      <IonPage>
        <IonContent className="ion-padding" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IonSpinner />
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Dashboard</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={fetchDashboardData}>
              <IonIcon icon={refreshOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <IonGrid>
          <IonRow>
            <IonCol size="6">
              <IonCard>
                <IonCardContent style={{ textAlign: 'center' }}>
                  <h2>{stats.piggeryCount}</h2>
                  <p>Piggeries</p>
                </IonCardContent>
              </IonCard>
            </IonCol>
            <IonCol size="6">
              <IonCard>
                <IonCardContent style={{ textAlign: 'center' }}>
                  <h2>{stats.deviceCount}</h2>
                  <p>Devices</p>
                </IonCardContent>
              </IonCard>
            </IonCol>
          </IonRow>

          <IonRow>
            <IonCol size="6">
              <IonCard>
                <IonCardContent style={{ textAlign: 'center' }}>
                  <h2>{stats.activeDevices}</h2>
                  <p>Active Devices</p>
                </IonCardContent>
              </IonCard>
            </IonCol>
            <IonCol size="6">
              <IonCard>
                <IonCardContent style={{ textAlign: 'center' }}>
                  <h2 style={{ color: stats.alertCount > 0 ? 'red' : 'green' }}>
                    {stats.alertCount}
                  </h2>
                  <p>Alerts</p>
                </IonCardContent>
              </IonCard>
            </IonCol>
          </IonRow>

          <IonRow>
            <IonCol size="12">
              <IonCard>
                <IonCardContent>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    <IonChip color={stats.latestAmmonia > 70 ? 'danger' : stats.latestAmmonia > 40 ? 'warning' : 'success'}>
                      <IonLabel>Latest NH3: {stats.latestAmmonia.toFixed(1)} ppm</IonLabel>
                    </IonChip>
                    <IonChip color="primary">
                      <IonLabel>Average NH3: {stats.averageAmmonia.toFixed(1)} ppm</IonLabel>
                    </IonChip>
                  </div>
                </IonCardContent>
              </IonCard>
            </IonCol>
          </IonRow>
        </IonGrid>

        {stats.alertCount > 0 && (
          <IonCard color="danger" button onClick={() => navigate('/my-alerts')}>
            <IonCardContent style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <IonIcon icon={alertCircle} size="large" />
              <div>
                <h3>You have {stats.alertCount} unread alert{stats.alertCount > 1 ? 's' : ''}</h3>
                <p style={{ fontSize: '14px' }}>Tap to view</p>
              </div>
            </IonCardContent>
          </IonCard>
        )}
      </IonContent>
    </IonPage>
  );
}