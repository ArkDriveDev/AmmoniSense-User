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
  IonMenuButton,
  IonMenuToggle,
  IonButtons,
  IonButton,
  IonAvatar,
  IonText
} from '@ionic/react';
import { menuController } from '@ionic/core';

import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../services/supabase';
import offlineStorage from '../services/OfflineStorageService';
import SyncStatusBanner from '../components/common/SyncStatusBanner';
import {
  homeOutline,
  businessOutline,
  hardwareChipOutline,
  barChartOutline,
  logOutOutline,
  personCircleOutline,
  closeOutline,
  menuOutline,
  mapOutline,
  shapesOutline
} from 'ionicons/icons';
import { useEffect, useState } from 'react';

export default function UserLayout({ children }: any) {
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState('User');
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const cached = offlineStorage.getSession();
      if (cached?.profile?.email) {
        setUserEmail(cached.profile.email);
        if (cached.profile.full_name) setUserName(cached.profile.full_name);
      }

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

  const handleNavigate = async (path: string) => {
    try {
      await menuController.close('user-menu');
    } catch (e) {}
    navigate(path);
  };

  const logout = async () => {
    try {
      await menuController.close('user-menu');
    } catch (e) {}
    try {
      await supabase.auth.signOut();
    } catch {}
    offlineStorage.clearSession();
    navigate('/login');
  };

  const isActive = (path: string) => {
    return location.pathname === path;
  };

  return (
    <IonSplitPane contentId="user-main">
      {/* SIDEBAR MENU */}
      <IonMenu menuId="user-menu" contentId="user-main" type="overlay" side="start">
        <IonHeader>
          <IonToolbar style={{ '--background': 'linear-gradient(135deg, #0F3C5C 0%, #1D5D9B 100%)', '--color': '#ffffff' }}>
            <IonTitle style={{ fontSize: '17px', fontWeight: 'bold', color: '#ffffff' }}>
              AmmoniSense
            </IonTitle>
            <IonButtons slot="end">
              <IonMenuToggle menu="user-menu" autoHide={false}>
                <IonButton fill="clear" onClick={() => menuController.close('user-menu')} style={{ color: '#ffffff' }}>
                  <IonIcon icon={closeOutline} />
                </IonButton>
              </IonMenuToggle>
            </IonButtons>
          </IonToolbar>
        </IonHeader>

        <IonContent style={{ '--background': '#ffffff' }}>
          {/* User Profile */}
          <div
            style={{
              padding: '20px 16px',
              textAlign: 'center',
              borderBottom: '1px solid #E2E8F0',
              background: 'linear-gradient(180deg, rgba(29, 93, 155, 0.05) 0%, rgba(255, 255, 255, 1) 100%)',
            }}
          >
            <IonAvatar
              style={{
                width: '64px',
                height: '64px',
                margin: '0 auto 10px auto',
                backgroundColor: '#1D5D9B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(29, 93, 155, 0.25)',
              }}
            >
              <IonIcon icon={personCircleOutline} style={{ fontSize: '48px', color: 'white' }} />
            </IonAvatar>
            <IonText>
              <h3 style={{ margin: '4px 0 2px 0', fontWeight: 'bold', color: '#0F172A', fontSize: '16px' }}>{userName}</h3>
              <p style={{ fontSize: '12px', color: '#64748B', margin: 0 }}>{userEmail}</p>
            </IonText>
          </div>

          {/* Navigation Items with MenuAutoClose */}
          <IonList style={{ padding: '8px 0', background: 'transparent' }}>
            <IonMenuToggle menu="user-menu" autoHide={false}>
              <IonItem
                button
                onClick={() => handleNavigate('/dashboard')}
                color={isActive('/dashboard') ? 'primary' : undefined}
                style={isActive('/dashboard') ? { borderLeft: '4px solid #1D5D9B', fontWeight: 'bold' } : {}}
              >
                <IonIcon icon={homeOutline} slot="start" color={isActive('/dashboard') ? 'light' : 'primary'} />
                <IonLabel>Dashboard</IonLabel>
              </IonItem>
            </IonMenuToggle>

            <IonMenuToggle menu="user-menu" autoHide={false}>
              <IonItem
                button
                onClick={() => handleNavigate('/map')}
                color={isActive('/map') || isActive('/spatial-map') ? 'primary' : undefined}
                style={isActive('/map') || isActive('/spatial-map') ? { borderLeft: '4px solid #1D5D9B', fontWeight: 'bold' } : {}}
              >
                <IonIcon icon={mapOutline} slot="start" color={isActive('/map') || isActive('/spatial-map') ? 'light' : 'primary'} />
                <IonLabel>Spatial Map</IonLabel>
              </IonItem>
            </IonMenuToggle>

            <IonMenuToggle menu="user-menu" autoHide={false}>
              <IonItem
                button
                onClick={() => handleNavigate('/area-mapping')}
                color={isActive('/area-mapping') ? 'primary' : undefined}
                style={isActive('/area-mapping') ? { borderLeft: '4px solid #1D5D9B', fontWeight: 'bold' } : {}}
              >
                <IonIcon icon={shapesOutline} slot="start" color={isActive('/area-mapping') ? 'light' : 'warning'} />
                <IonLabel>Odor Zone Mapping</IonLabel>
              </IonItem>
            </IonMenuToggle>

            <IonMenuToggle menu="user-menu" autoHide={false}>
              <IonItem
                button
                onClick={() => handleNavigate('/monitoring-sites')}
                color={isActive('/monitoring-sites') || isActive('/my-piggeries') ? 'primary' : undefined}
                style={isActive('/monitoring-sites') || isActive('/my-piggeries') ? { borderLeft: '4px solid #1D5D9B', fontWeight: 'bold' } : {}}
              >
                <IonIcon icon={businessOutline} slot="start" color={isActive('/monitoring-sites') || isActive('/my-piggeries') ? 'light' : 'primary'} />
                <IonLabel>Monitoring Sites</IonLabel>
              </IonItem>
            </IonMenuToggle>

            <IonMenuToggle menu="user-menu" autoHide={false}>
              <IonItem
                button
                onClick={() => handleNavigate('/devices')}
                color={isActive('/devices') || isActive('/my-devices') ? 'primary' : undefined}
                style={isActive('/devices') || isActive('/my-devices') ? { borderLeft: '4px solid #1D5D9B', fontWeight: 'bold' } : {}}
              >
                <IonIcon icon={hardwareChipOutline} slot="start" color={isActive('/devices') || isActive('/my-devices') ? 'light' : 'primary'} />
                <IonLabel>Devices</IonLabel>
              </IonItem>
            </IonMenuToggle>

            <IonMenuToggle menu="user-menu" autoHide={false}>
              <IonItem
                button
                onClick={() => handleNavigate('/my-sensor-data')}
                color={isActive('/my-sensor-data') || isActive('/sensor-data') ? 'primary' : undefined}
                style={isActive('/my-sensor-data') || isActive('/sensor-data') ? { borderLeft: '4px solid #1D5D9B', fontWeight: 'bold' } : {}}
              >
                <IonIcon icon={barChartOutline} slot="start" color={isActive('/my-sensor-data') || isActive('/sensor-data') ? 'light' : 'primary'} />
                <IonLabel>Sensor Data</IonLabel>
              </IonItem>
            </IonMenuToggle>

            <IonMenuToggle menu="user-menu" autoHide={false}>
              <IonItem
                button
                onClick={logout}
                style={{ marginTop: '16px' }}
              >
                <IonIcon icon={logOutOutline} slot="start" color="danger" />
                <IonLabel color="danger" style={{ fontWeight: 600 }}>Logout</IonLabel>
              </IonItem>
            </IonMenuToggle>
          </IonList>
        </IonContent>
      </IonMenu>

      {/* MAIN CONTENT */}
      <IonPage id="user-main">
        <IonHeader>
          <IonToolbar style={{ '--background': 'linear-gradient(135deg, #0F3C5C 0%, #1D5D9B 100%)', '--color': '#ffffff' }}>
            <IonButtons slot="start">
              <IonMenuButton menu="user-menu" style={{ color: '#ffffff' }}>
                <IonIcon icon={menuOutline} />
              </IonMenuButton>
            </IonButtons>
            <IonTitle style={{ fontWeight: 700, color: '#ffffff' }}>AmmoniSense</IonTitle>
            <IonButtons slot="end" style={{ paddingRight: '12px' }}>
              <SyncStatusBanner />
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent style={{ '--background': '#F8FAFC' }}>
          {children}
        </IonContent>
      </IonPage>
    </IonSplitPane>
  );
}