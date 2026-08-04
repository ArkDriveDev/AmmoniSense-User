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
  IonBadge,
  IonMenuButton,
  IonButtons,
  IonAvatar,
  IonText
} from '@ionic/react';

import { useNavigate, useLocation } from 'react-router-dom';  // ← CHANGED
import { supabase } from '../services/supabase';
import {
  homeOutline,
  businessOutline,
  hardwareChipOutline,
  barChartOutline,
  logOutOutline,
  personCircleOutline,
  closeOutline,
  menuOutline
} from 'ionicons/icons';
import { useEffect, useState } from 'react';

export default function UserLayout({ children }: any) {
  const navigate = useNavigate();  // ← CHANGED (was useHistory)
  const location = useLocation();
  const [userName, setUserName] = useState('User');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    fetchUserProfile();
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
      
      if (userData.user?.email) {
        setUserEmail(userData.user.email);
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    navigate('/login');  // ← CHANGED (was history.push)
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <IonSplitPane contentId="user-main">
      {/* SIDEBAR MENU */}
      <IonMenu contentId="user-main" type="push" side="start">
        <IonHeader>
          <IonToolbar>
            <IonTitle style={{ fontSize: '18px', fontWeight: 'bold' }}>
              Ammonisense Monitor
            </IonTitle>
            <IonButtons slot="end">
              <IonMenuButton autoHide={false}>
                <IonIcon icon={closeOutline} />
              </IonMenuButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>

        <IonContent>
          {/* User Profile */}
          <div style={{ 
            padding: '16px', 
            textAlign: 'center',
            borderBottom: '1px solid var(--ion-color-light)',
            marginBottom: '8px'
          }}>
            <IonAvatar style={{ 
              width: '64px', 
              height: '64px', 
              margin: '0 auto 8px auto',
              backgroundColor: 'var(--ion-color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <IonIcon icon={personCircleOutline} style={{ 
                fontSize: '48px', 
                color: 'white' 
              }} />
            </IonAvatar>
            <IonText>
              <h3 style={{ margin: '4px 0', fontWeight: 'bold' }}>{userName}</h3>
              <p style={{ fontSize: '12px', color: 'gray', margin: '0' }}>{userEmail}</p>
            </IonText>
          </div>

          {/* Navigation */}
          <IonList style={{ padding: '0' }}>
            <IonItem 
              button 
              onClick={() => navigate('/dashboard')}  // ← CHANGED
              color={isActive('/dashboard') ? 'primary' : undefined}
              style={isActive('/dashboard') ? { 
                borderLeft: '4px solid var(--ion-color-primary)',
                fontWeight: 'bold'
              } : {}}
            >
              <IonIcon icon={homeOutline} slot="start" />
              <IonLabel>Dashboard</IonLabel>
            </IonItem>

            <IonItem 
              button 
              onClick={() => navigate('/monitoring-sites')}
              color={isActive('/monitoring-sites') || isActive('/my-piggeries') ? 'primary' : undefined}
              style={isActive('/monitoring-sites') || isActive('/my-piggeries') ? { 
                borderLeft: '4px solid var(--ion-color-primary)',
                fontWeight: 'bold'
              } : {}}
            >
              <IonIcon icon={businessOutline} slot="start" />
              <IonLabel>Monitoring Sites</IonLabel>
            </IonItem>

            <IonItem 
              button 
              onClick={() => navigate('/devices')}
              color={isActive('/devices') || isActive('/my-devices') ? 'primary' : undefined}
              style={isActive('/devices') || isActive('/my-devices') ? { 
                borderLeft: '4px solid var(--ion-color-primary)',
                fontWeight: 'bold'
              } : {}}
            >
              <IonIcon icon={hardwareChipOutline} slot="start" />
              <IonLabel>Devices</IonLabel>
            </IonItem>

            <IonItem 
              button 
              onClick={() => navigate('/my-sensor-data')}
              color={isActive('/my-sensor-data') || isActive('/sensor-data') ? 'primary' : undefined}
              style={isActive('/my-sensor-data') || isActive('/sensor-data') ? { 
                borderLeft: '4px solid var(--ion-color-primary)',
                fontWeight: 'bold'
              } : {}}
            >
              <IonIcon icon={barChartOutline} slot="start" />
              <IonLabel>Sensor Data</IonLabel>
            </IonItem>

            <IonItem 
              button 
              onClick={logout}
              style={{ marginTop: '8px' }}
            >
              <IonIcon icon={logOutOutline} slot="start" />
              <IonLabel color="danger">Logout</IonLabel>
            </IonItem>
          </IonList>
        </IonContent>
      </IonMenu>

      {/* MAIN CONTENT */}
      <IonPage id="user-main">
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonMenuButton>
                <IonIcon icon={menuOutline} />
              </IonMenuButton>
            </IonButtons>
            <IonTitle>Ammonisense Monitor</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          {children}
        </IonContent>
      </IonPage>
    </IonSplitPane>
  );
}