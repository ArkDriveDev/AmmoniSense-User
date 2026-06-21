import {
  IonSplitPane,
  IonMenu,
  IonContent,
  IonList,
  IonItem,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonPage,
  IonIcon,
  IonLabel,
  IonBadge
} from '@ionic/react';

import { useNavigate } from 'react-router-dom'; // Change this
import { supabase } from '../services/supabase';
import {
  homeOutline,
  businessOutline,
  hardwareChipOutline,
  barChartOutline,
  alertCircleOutline,
  logOutOutline
} from 'ionicons/icons';
import { useEffect, useState } from 'react';

export default function UserLayout({ children }: any) {
  const navigate = useNavigate(); // Change this
  const [userName, setUserName] = useState('User');
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    fetchUserProfile();
    fetchAlertCount();

    const subscription = supabase
      .channel('user_alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'alerts'
        },
        () => {
          setAlertCount(prev => prev + 1);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const fetchUserProfile = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      if (!userId) return;

      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', userId)
        .single();

      if (data?.full_name) {
        setUserName(data.full_name);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  const fetchAlertCount = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      if (!userId) return;

      const { data: piggeries } = await supabase
        .from('piggeries')
        .select('id')
        .eq('clients.profile_id', userId);

      const piggeryIds = piggeries?.map(p => p.id) || [];

      if (piggeryIds.length === 0) {
        setAlertCount(0);
        return;
      }

      const { count } = await supabase
        .from('alerts')
        .select('id', { count: 'exact', head: true })
        .in('piggery_id', piggeryIds)
        .eq('is_read', false);

      setAlertCount(count || 0);
    } catch (err) {
      console.error('Error fetching alert count:', err);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate('/login'); // Change this
  };

  return (
    <IonSplitPane contentId="user-main">
      <IonMenu contentId="user-main">
        <IonHeader>
          <IonToolbar>
            <IonTitle>Ammonisense</IonTitle>
          </IonToolbar>
        </IonHeader>

        <IonContent>
          <div style={{ padding: '16px', textAlign: 'center' }}>
            <h3>Welcome, {userName}</h3>
          </div>

          <IonList>
            <IonItem button onClick={() => navigate('/dashboard')}>
              <IonIcon icon={homeOutline} slot="start" />
              <IonLabel>Dashboard</IonLabel>
            </IonItem>

            <IonItem button onClick={() => navigate('/my-piggeries')}>
              <IonIcon icon={businessOutline} slot="start" />
              <IonLabel>My Piggeries</IonLabel>
            </IonItem>

            <IonItem button onClick={() => navigate('/my-devices')}>
              <IonIcon icon={hardwareChipOutline} slot="start" />
              <IonLabel>My Devices</IonLabel>
            </IonItem>

            <IonItem button onClick={() => navigate('/my-sensor-data')}>
              <IonIcon icon={barChartOutline} slot="start" />
              <IonLabel>Sensor Data</IonLabel>
            </IonItem>

            <IonItem button onClick={() => navigate('/my-alerts')}>
              <IonIcon icon={alertCircleOutline} slot="start" />
              <IonLabel>Alerts</IonLabel>
              {alertCount > 0 && (
                <IonBadge color="danger" slot="end">
                  {alertCount}
                </IonBadge>
              )}
            </IonItem>

            <IonItem button onClick={logout}>
              <IonIcon icon={logOutOutline} slot="start" />
              <IonLabel>Logout</IonLabel>
            </IonItem>
          </IonList>
        </IonContent>
      </IonMenu>

      <IonPage id="user-main">
        {children}
      </IonPage>
    </IonSplitPane>
  );
}