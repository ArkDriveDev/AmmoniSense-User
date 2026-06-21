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
  IonChip,
  IonSelect,
  IonSelectOption
} from '@ionic/react';

import { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { refreshOutline } from 'ionicons/icons';

export default function UserSensorData() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDevice, setSelectedDevice] = useState('all');
  const [devices, setDevices] = useState<any[]>([]);

  useEffect(() => {
    fetchDevices();
  }, []);

  useEffect(() => {
    if (devices.length > 0) {
      fetchSensorData();
    }
  }, [selectedDevice, devices]);

  const fetchDevices = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      if (!userId) return;

      const { data } = await supabase
        .from('devices')
        .select(`
          *,
          piggeries!inner (
            clients!inner (profile_id)
          )
        `)
        .eq('piggeries.clients.profile_id', userId);

      setDevices(data || []);
    } catch (err) {
      console.error('Error fetching devices:', err);
    }
  };

  const fetchSensorData = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('sensor_data')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (selectedDevice !== 'all') {
        query = query.eq('device_uid', selectedDevice);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching sensor data:', error);
        return;
      }

      setLogs(data || []);
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async (event: CustomEvent) => {
    await fetchSensorData();
    event.detail.complete();
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Sensor Data</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={fetchSensorData}>
              <IonIcon icon={refreshOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <div style={{ marginBottom: '16px' }}>
          <IonSelect
            value={selectedDevice}
            placeholder="Select Device"
            onIonChange={(e) => setSelectedDevice(e.detail.value)}
          >
            <IonSelectOption value="all">All Devices</IonSelectOption>
            {devices.map((d) => (
              <IonSelectOption key={d.device_uid} value={d.device_uid}>
                {d.device_uid}
              </IonSelectOption>
            ))}
          </IonSelect>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <IonSpinner />
            <p>Loading sensor data...</p>
          </div>
        ) : logs.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '40px' }}>
            <p>No sensor data available.</p>
          </div>
        ) : (
          <IonList>
            {logs.map((l) => (
              <IonItem key={l.id}>
                <IonLabel>
                  <h2>
                    <IonChip color={l.ammonia > 70 ? 'danger' : l.ammonia > 40 ? 'warning' : 'success'}>
                      <IonLabel>NH3: {l.ammonia.toFixed(1)} ppm</IonLabel>
                    </IonChip>
                  </h2>
                  <p>Device: {l.device_uid}</p>
                  <p>Battery: {l.battery?.toFixed(1)}%</p>
                  <p>Sunlight: {l.sunlight} lux</p>
                  <p style={{ fontSize: '12px', color: 'gray' }}>
                    {new Date(l.created_at).toLocaleString()}
                  </p>
                </IonLabel>
                <IonBadge color={l.status === 'LOW' ? 'success' : l.status === 'MODERATE' ? 'warning' : 'danger'}>
                  {l.status || 'Unknown'}
                </IonBadge>
              </IonItem>
            ))}
          </IonList>
        )}
      </IonContent>
    </IonPage>
  );
}