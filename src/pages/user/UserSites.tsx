import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonList,
  IonItem,
  IonLabel,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonButton,
  IonButtons,
  IonIcon,
  IonBadge,
  IonCard,
  IonCardContent
} from '@ionic/react';

import { useEffect, useState } from 'react';
import { supabase } from '../../services/supabase';
import offlineStorage from '../../services/OfflineStorageService';
import { deleteSite } from '../../services/siteService';
import PendingSyncBadge from '../../components/common/PendingSyncBadge';
import { OfflineSite } from '../../types/site';
import {
  refreshOutline,
  locationOutline,
  addOutline,
  businessOutline,
  hardwareChipOutline,
  chevronForwardOutline,
  createOutline,
  trashOutline
} from 'ionicons/icons';
import { useNavigate } from 'react-router-dom';
import CreateSiteModal from '../../components/sites/CreateSiteModal';

export default function UserSites() {
  const navigate = useNavigate();
  const [sites, setSites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deviceCounts, setDeviceCounts] = useState<Record<string | number, number>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingOfflineSite, setEditingOfflineSite] = useState<OfflineSite | null>(null);

  useEffect(() => {
    fetchSites();

    const handleSiteDeleted = () => {
      fetchSites();
    };

    window.addEventListener('site_deleted', handleSiteDeleted);
    window.addEventListener('site_synced', handleSiteDeleted);

    return () => {
      window.removeEventListener('site_deleted', handleSiteDeleted);
      window.removeEventListener('site_synced', handleSiteDeleted);
    };
  }, []);

  const fetchSites = async () => {
    setLoading(true);
    let onlineSitesList: any[] = [];

    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;