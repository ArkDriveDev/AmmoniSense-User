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