import React, { useEffect, useState } from 'react';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonTextarea,
  IonSpinner,
  IonToast,
  IonIcon,
  IonRow,
  IonCol,
  IonGrid,
  IonCard,
  IonCardContent,
  IonBadge,
  IonRange
} from '@ionic/react';
import {
  locateOutline,
  addCircleOutline,
  cameraOutline,
  imageOutline,
  checkmarkCircleOutline,
  warningOutline,
  navigateOutline
} from 'ionicons/icons';
import { Geolocation } from '@capacitor/geolocation';
import { captureSitePhoto, InspectionPhotoRecord } from '../../utils/photoUtils';
import { registerSiteWithPhoto } from '../../services/siteService';
import { supabase } from '../../services/supabase';
import offlineStorage, { SITE_DRAFT_KEY } from '../../services/OfflineStorageService';
import syncService from '../../services/SyncService';
import { GpsSource, OfflineSite } from '../../types/site';
import PolygonPreview from '../map/PolygonPreview';

export interface CreateSiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSiteCreated?: (newSite: any) => void;
  editSite?: OfflineSite | null;
}

export const CreateSiteModal: React.FC<CreateSiteModalProps> = ({ isOpen, onClose, onSiteCreated, editSite }) => {
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [capturingPhoto, setCapturingPhoto] = useState(false);

  const [photoRecord, setPhotoRecord] = useState<InspectionPhotoRecord | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [gpsSource, setGpsSource] = useState<GpsSource>('device_gps');

  const [form, setForm] = useState({
    site_code: `SITE-${Math.floor(1000 + Math.random() * 9000)}`,
    site_name: '',
    site_type: 'Piggery',
    address: '',
    area_size_hectares: '1.0',
    current_latitude: 8.3683,
    current_longitude: 124.8637,
    notes: '',
  });

  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (editSite) {
        setForm({
          site_code: editSite.site_code || `SITE-${Math.floor(1000 + Math.random() * 9000)}`,
          site_name: editSite.site_name || '',
          site_type: editSite.site_type || 'Piggery',
          address: editSite.address || '',
          area_size_hectares: (editSite.area_size_hectares || 1.0).toString(),
          current_latitude: editSite.current_latitude || 8.3683,
          current_longitude: editSite.current_longitude || 124.8637,
          notes: editSite.notes || '',
        });
        if (editSite.site_photo_url) {
          setPhotoPreview(editSite.site_photo_url);
        }
      } else {
        const draft = offlineStorage.getDraft<typeof form>(SITE_DRAFT_KEY);
        if (draft && draft.site_name) {
          setForm(draft);
        } else if (!photoPreview) {
          fetchCurrentGps();
        }
      }
    }
  }, [isOpen, editSite]);

  const updateForm = (fields: Partial<typeof form>) => {
    setForm(prev => {
      const updated = { ...prev, ...fields };
      if (!editSite) {
        offlineStorage.saveDraft(SITE_DRAFT_KEY, updated);
      }
      return updated;
    });
  };

  const fetchCurrentGps = async () => {
    setLocating(true);
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      updateForm({
        current_latitude: pos.coords.latitude,
        current_longitude: pos.coords.longitude,
      });
      setGpsSource('device_gps');
    } catch (err) {
      console.warn('GPS location fetch error:', err);
      setGpsSource('manual');
    } finally {
      setLocating(false);
    }
  };

  const handleTakeSitePhoto = async () => {
    setCapturingPhoto(true);
    try {
      const result = await captureSitePhoto(form.site_name || 'New Site');
      setPhotoRecord(result.photoRecord);
      setPhotoPreview(result.dataUrl || result.photoRecord.photo_url);

      if (result.latitude && result.longitude) {
        updateForm({
          current_latitude: result.latitude,
          current_longitude: result.longitude,
        });