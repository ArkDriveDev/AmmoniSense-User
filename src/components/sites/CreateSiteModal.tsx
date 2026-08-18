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
      }

      setGpsSource(result.gpsSource);

      const sourceLabel =
        result.gpsSource === 'photo_exif'
          ? 'Photo EXIF GPS'
          : result.gpsSource === 'device_gps'
          ? 'Device Live GPS'
          : 'Manual Default Coordinates';

      setToastMsg(`Photo captured! Coordinates auto-filled from ${sourceLabel}.`);
      setShowToast(true);
    } catch (err: any) {
      console.error('Error capturing site photo:', err);
      setToastMsg(err.message || 'Camera permission denied or capture cancelled');
      setShowToast(true);
    } finally {
      setCapturingPhoto(false);
    }
  };

  const handleCreateSite = async () => {
    if (!form.site_name) {
      setToastMsg('Please enter a site name');
      setShowToast(true);
      return;
    }

    setLoading(true);

    const tempId = editSite?.id || `temp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const sitePayload = {
      temp_id: tempId,
      site_code: form.site_code,
      site_name: form.site_name,
      site_type: form.site_type,
      address: form.address || form.site_name,
      area_size_hectares: parseFloat(form.area_size_hectares) || 1.0,
      latitude: form.current_latitude,
      longitude: form.current_longitude,
      notes: form.notes,
      photo_record_id: photoRecord?.id,
      photo_url: photoRecord?.photo_url || photoPreview || undefined,
      gps_source: gpsSource,
    };

    if (editSite) {
      try {
        await offlineStorage.updateOfflineSite(editSite.id, {
          site_code: form.site_code,
          site_name: form.site_name,
          site_type: form.site_type,
          address: form.address || form.site_name,
          area_size_hectares: parseFloat(form.area_size_hectares) || 1.0,
          current_latitude: form.current_latitude,
          current_longitude: form.current_longitude,
          site_photo_url: photoPreview || editSite.site_photo_url || '',
          site_photo_thumbnail: photoPreview || editSite.site_photo_thumbnail || '',
          notes: form.notes,
          lastModified: new Date().toISOString(),
        });

        setToastMsg(`Offline site "${form.site_name}" updated locally.`);
        setShowToast(true);

        if (onSiteCreated) {
          onSiteCreated({ ...editSite, ...sitePayload });
        }
        onClose();
      } catch (err: any) {
        console.error('Error updating offline site locally:', err);
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      if (!syncService.isOnline()) {
        throw new Error('OFFLINE_MODE');
      }

      const result = await registerSiteWithPhoto(sitePayload);

      setToastMsg(`Monitoring Site "${result.site.site_name}" created successfully!`);
      setShowToast(true);
      offlineStorage.clearDraft(SITE_DRAFT_KEY);

      if (onSiteCreated) onSiteCreated(result.site);

      setPhotoRecord(null);
      setPhotoPreview(null);
      onClose();
    } catch (err: any) {
      console.warn('Network error or offline mode during site creation, queueing item:', err);
      
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id || 'inspector_user';

      const offlineSiteRecord: OfflineSite = {
        id: tempId,
        isOffline: true,
        isSynced: false,
        site_code: form.site_code,
        site_name: form.site_name,
        site_type: form.site_type,
        owner_id: null,
        owner: {
          owner_name: 'Inspector Owner',
          contact_number: '',
          email: '',
          address: form.address || form.site_name,
        },
        current_latitude: form.current_latitude,
        current_longitude: form.current_longitude,
        address: form.address || form.site_name,
        area_size_hectares: parseFloat(form.area_size_hectares) || 1.0,
        site_photo_url: photoPreview || photoRecord?.photo_url || '',
        site_photo_thumbnail: photoPreview || photoRecord?.photo_url || '',
        created_at: new Date().toISOString(),
        created_by: userId,
        notes: form.notes,
        syncStatus: 'pending',
        retryCount: 0,
        lastModified: new Date().toISOString(),
      };

      await offlineStorage.saveOfflineSite(offlineSiteRecord);

      await offlineStorage.enqueueItem('SITE_REGISTRATION', sitePayload);
      offlineStorage.clearDraft(SITE_DRAFT_KEY);

      setToastMsg(`📶 Offline Mode: Site "${form.site_name}" saved locally & queued for auto-sync!`);
      setShowToast(true);

      if (onSiteCreated) onSiteCreated(offlineSiteRecord);

      setPhotoRecord(null);
      setPhotoPreview(null);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const renderGpsBadge = () => {
    if (gpsSource === 'photo_exif') {
      return (
        <IonBadge style={{ background: '#ECFDF5', color: '#065F46', padding: '6px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
          <IonIcon icon={checkmarkCircleOutline} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
          Photo EXIF GPS
        </IonBadge>
      );
    } else if (gpsSource === 'device_gps') {
      return (
        <IonBadge style={{ background: '#EBF3FA', color: '#1D5D9B', padding: '6px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
          <IonIcon icon={navigateOutline} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
          Device Live GPS
        </IonBadge>
      );
    } else {
      return (
        <IonBadge style={{ background: '#FFFBEB', color: '#92400E', padding: '6px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: 700 }}>
          <IonIcon icon={warningOutline} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
          Manual Coordinates
        </IonBadge>
      );
    }
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      <IonHeader className="ion-no-border">
        <IonToolbar style={{ '--background': 'linear-gradient(135deg, #0F3C5C 0%, #1D5D9B 100%)', '--color': '#ffffff' }}>
          <IonTitle style={{ fontWeight: 700 }}>Register Monitoring Site</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose} style={{ color: '#ffffff' }}>Cancel</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" style={{ '--background': '#F1F5F9' }}>
        <IonGrid style={{ maxWidth: '600px', margin: '0 auto' }}>
          <IonCard className="premium-card" style={{ margin: '0 0 20px 0', padding: '16px' }}>
            <IonCardContent className="ion-text-center">
              <span style={{ fontSize: '13px', fontWeight: '700', color: '#0F172A', display: 'block', marginBottom: '10px' }}>
                Facility / Site Entrance Photo (Auto-Extract GPS)
              </span>

              {photoPreview ? (
                <div style={{ position: 'relative', display: 'inline-block', width: '100%', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }}>
                  <img
                    src={photoPreview}
                    alt="Captured Site"
                    style={{ width: '100%', height: '190px', objectFit: 'cover' }}
                  />
                  <IonButton
                    size="small"
                    color="light"
                    onClick={handleTakeSitePhoto}
                    disabled={capturingPhoto}
                    style={{ position: 'absolute', bottom: '10px', right: '10px', fontWeight: 700 }}
                  >
                    <IonIcon icon={cameraOutline} slot="start" />
                    Retake Photo
                  </IonButton>
                </div>
              ) : (
                <div style={{ padding: '20px 0' }}>
                  <div style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '16px',
                    background: 'rgba(29, 93, 155, 0.1)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '10px'
                  }}>
                    <IonIcon icon={imageOutline} style={{ fontSize: '32px', color: '#1D5D9B' }} />
                  </div>
                  <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 16px 0' }}>
                    Capture entrance photo to embed EXIF GPS coordinates directly
                  </p>
                  <IonButton className="btn-ammoni btn-secondary" onClick={handleTakeSitePhoto} disabled={capturingPhoto}>
                    {capturingPhoto ? (
                      <>
                        <IonSpinner name="crescent" />
                        &nbsp;Opening Camera...
                      </>
                    ) : (
                      <>
                        <IonIcon icon={cameraOutline} slot="start" />
                        Capture Photo & Extract GPS
                      </>
                    )}
                  </IonButton>
                </div>
              )}
            </IonCardContent>
          </IonCard>

          <IonItem className="premium-input-item" lines="none">