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
    setLoading(true);
    let serverRecords: SensorRecord[] = [];
    try {
      const query = supabase
        .from('sensor_data')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      const { data, error } = await query;
      if (!error && data) {
        serverRecords = data;
      }
    } catch (err) {
      console.warn('Error or offline during fetchSensorData:', err);
    }

    try {
      const queue = await offlineStorage.getQueue();
      const pendingReadings = queue
        .filter(q => q.type === 'SENSOR_READING')
        .map(q => ({
          id: q.id,
          device_uid: q.payload.device_uid || 'ESP32-AMMONIA-NODE-01',
          ammonia: q.payload.ammonia || 0,
          temperature: q.payload.temperature,
          humidity: q.payload.humidity,
          battery: q.payload.battery,
          status: q.payload.status || 'LOW',
          latitude: q.payload.latitude,
          longitude: q.payload.longitude,
          created_at: q.timestamp,
          photo_url: q.payload.photo_url,
          is_pending_sync: true,
        }));