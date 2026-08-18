import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonBadge,
  IonButton,
  IonButtons,
  IonIcon,
  IonCard,
  IonCardContent
} from '@ionic/react';

import { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import { refreshOutline, hardwareChipOutline, wifiOutline, timeOutline } from 'ionicons/icons';
import { useLocation } from 'react-router-dom';

export default function UserDevices() {
  const location = useLocation();
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [siteName, setSiteName] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const siteId = params.get('site') || params.get('piggery');
    fetchDevices(siteId);
  }, [location]);

  const fetchDevices = async (siteId: string | null) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      if (!userId) {
        setLoading(false);
        return;
      }

      const { data: owners } = await supabase
        .from('site_owners')
        .select('id')
        .eq('created_by', userId);

      const ownerId = owners && owners.length > 0 ? owners[0].id : null;

      let siteQuery = supabase
        .from('monitoring_sites')
        .select('id, site_name');

      if (ownerId) {
        siteQuery = siteQuery.eq('owner_id', ownerId);
      }
      if (siteId) {
        siteQuery = siteQuery.eq('id', parseInt(siteId));
      }

      const { data: siteList } = await siteQuery;

      if (siteId && siteList && siteList.length > 0) {
        setSiteName(siteList[0].site_name);
      }

      const siteIds = siteList?.map(s => s.id) || [];

      let deviceQuery = supabase.from('devices').select('*');
      if (siteIds.length > 0) {
        deviceQuery = deviceQuery.in('site_id', siteIds);
      }

      const { data, error } = await deviceQuery;

      if (error) {
        console.error('Error fetching devices:', error);
        return;
      }

      setDevices(data || []);
    } catch (err) {
      console.error('Unexpected error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async (event: CustomEvent) => {
    const params = new URLSearchParams(location.search);
    await fetchDevices(params.get('site') || params.get('piggery'));
    event.detail.complete();
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar style={{ '--background': 'linear-gradient(135deg, #0F3C5C 0%, #1D5D9B 100%)', '--color': '#ffffff' }}>
          <IonTitle style={{ fontWeight: 700 }}>{siteName ? `${siteName} — Devices` : 'Environmental Devices'}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => {
              const params = new URLSearchParams(location.search);