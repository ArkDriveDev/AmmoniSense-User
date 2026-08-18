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