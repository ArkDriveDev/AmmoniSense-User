import React, { useEffect, useState } from 'react';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonGrid,
  IonRow,
  IonCol,
  IonBadge,
  IonButton,
  IonIcon,
  IonModal,
  IonSpinner
} from '@ionic/react';
import { eyeOutline, locationOutline, calendarOutline, hardwareChipOutline, imageOutline, mapOutline } from 'ionicons/icons';
import { supabase } from '../../services/supabase';
import FullMapView, { ReadingMarkerData } from '../map/FullMapView';
import offlineStorage from '../../services/OfflineStorageService';
import PendingSyncBadge from '../common/PendingSyncBadge';

export interface SensorRecord {
  id: number | string;
  device_uid: string;
  ammonia: number;
  temperature?: number;
  humidity?: number;
  battery?: number;
  status: string;
  latitude?: number;
  longitude?: number;
  created_at: string;
  photo_url?: string;
  submitted_by?: string;
  is_pending_sync?: boolean;
}

export const AdminSensorDataViewer: React.FC = () => {
  const [sites, setSites] = useState<{ id: number; site_name: string; current_latitude?: number | null; current_longitude?: number | null; latitude?: number; longitude?: number }[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<number | 'all'>('all');

  const [records, setRecords] = useState<SensorRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [selectedPhotoRecord, setSelectedPhotoRecord] = useState<SensorRecord | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState<boolean>(false);

  useEffect(() => {
    fetchSites();
    fetchSensorData();
  }, []);

  useEffect(() => {
    fetchSensorData();
  }, [selectedSiteId]);

  const fetchSites = async () => {
    try {
      const { data } = await supabase.from('monitoring_sites').select('*');
      if (data) setSites(data);
    } catch (err) {
      console.error('Error fetching sites:', err);
    }
  };

  const fetchSensorData = async () => {