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
  mapOutline
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

  const logout = async () => {
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