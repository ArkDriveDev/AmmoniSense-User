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
  IonBadge
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
import offlineStorage, { SITE_DRAFT_KEY } from '../../services/OfflineStorageService';
import syncService from '../../services/SyncService';
import { GpsSource } from '../../types/site';

export interface CreateSiteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSiteCreated?: (newSite: any) => void;
}

export const CreateSiteModal: React.FC<CreateSiteModalProps> = ({ isOpen, onClose, onSiteCreated }) => {
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
    current_latitude: 14.5995,
    current_longitude: 120.9842,
    current_grid_cell_id: 'A1',
    notes: '',
  });

  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Restore draft if present
      const draft = offlineStorage.getDraft<typeof form>(SITE_DRAFT_KEY);
      if (draft && draft.site_name) {
        setForm(draft);
      } else if (!photoPreview) {
        fetchCurrentGps();
      }
    }
  }, [isOpen]);

  const updateForm = (fields: Partial<typeof form>) => {
    setForm(prev => {
      const updated = { ...prev, ...fields };
      offlineStorage.saveDraft(SITE_DRAFT_KEY, updated);
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
    const sitePayload = {
      site_code: form.site_code,
      site_name: form.site_name,
      site_type: form.site_type,
      address: form.address || form.site_name,
      area_size_hectares: parseFloat(form.area_size_hectares) || 1.0,
      latitude: form.current_latitude,
      longitude: form.current_longitude,
      grid_cell_id: form.current_grid_cell_id || 'A1',
      notes: form.notes,
      photo_record_id: photoRecord?.id,
      photo_url: photoRecord?.photo_url,
      gps_source: gpsSource,
    };

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
      
      // Save item to offline queue
      await offlineStorage.enqueueItem('SITE_REGISTRATION', sitePayload);
      offlineStorage.clearDraft(SITE_DRAFT_KEY);

      setToastMsg(`📶 Offline Mode: Site "${form.site_name}" queued locally for auto-sync!`);
      setShowToast(true);

      const optimisticSite = {
        id: `offline_${Date.now()}`,
        ...sitePayload,
        is_pending_sync: true,
      };

      if (onSiteCreated) onSiteCreated(optimisticSite);

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

          {/* Form Controls inside Glass Items */}
          <IonItem className="premium-input-item" lines="none">
            <IonLabel position="stacked" style={{ fontWeight: 700, color: '#0F172A' }}>Site Code</IonLabel>
            <IonInput
              value={form.site_code}
              onIonChange={e => setForm({ ...form, site_code: e.detail.value! })}
              placeholder="e.g. SITE-2026-001"
            />
          </IonItem>

          <IonItem className="premium-input-item" lines="none">
            <IonLabel position="stacked" style={{ fontWeight: 700, color: '#0F172A' }}>Site Name *</IonLabel>
            <IonInput
              value={form.site_name}
              onIonChange={e => setForm({ ...form, site_name: e.detail.value! })}
              placeholder="e.g. Silang Livestock Farm - Site A"
            />
          </IonItem>

          <IonItem className="premium-input-item" lines="none">
            <IonLabel position="stacked" style={{ fontWeight: 700, color: '#0F172A' }}>Site Category / Type</IonLabel>
            <IonSelect
              value={form.site_type}
              onIonChange={e => setForm({ ...form, site_type: e.detail.value! })}
            >
              <IonSelectOption value="Piggery">Piggery Farm</IonSelectOption>
              <IonSelectOption value="Poultry">Poultry Farm</IonSelectOption>
              <IonSelectOption value="Agricultural">Agricultural Zone</IonSelectOption>
              <IonSelectOption value="Industrial">Industrial Facility</IonSelectOption>
              <IonSelectOption value="River/Waterway">River / Waterway</IonSelectOption>
            </IonSelect>
          </IonItem>

          <IonItem className="premium-input-item" lines="none">
            <IonLabel position="stacked" style={{ fontWeight: 700, color: '#0F172A' }}>Address / Location Description</IonLabel>
            <IonInput
              value={form.address}
              onIonChange={e => setForm({ ...form, address: e.detail.value! })}
              placeholder="e.g. Brgy. San Pedro, Silang, Cavite"
            />
          </IonItem>

          <IonRow>
            <IonCol size="6">
              <IonItem className="premium-input-item" lines="none">
                <IonLabel position="stacked" style={{ fontWeight: 700, color: '#0F172A' }}>Area (Hectares)</IonLabel>
                <IonInput
                  type="number"
                  value={form.area_size_hectares}
                  onIonChange={e => setForm({ ...form, area_size_hectares: e.detail.value! })}
                />
              </IonItem>
            </IonCol>
            <IonCol size="6">
              <IonItem className="premium-input-item" lines="none">
                <IonLabel position="stacked" style={{ fontWeight: 700, color: '#0F172A' }}>Grid Cell ID</IonLabel>
                <IonInput
                  value={form.current_grid_cell_id}
                  onIonChange={e => setForm({ ...form, current_grid_cell_id: e.detail.value! })}
                />
              </IonItem>
            </IonCol>
          </IonRow>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: '700', color: '#0F172A' }}>
                GPS Telemetry
              </span>
              {renderGpsBadge()}
            </div>
            <IonButton fill="clear" size="small" onClick={fetchCurrentGps} disabled={locating} style={{ fontWeight: 700 }}>
              <IonIcon icon={locateOutline} slot="start" />
              {locating ? 'Acquiring...' : 'Refetch GPS'}
            </IonButton>
          </div>

          <IonRow>
            <IonCol size="6">
              <IonItem className="premium-input-item" lines="none">
                <IonLabel position="stacked" style={{ fontWeight: 700, color: '#0F172A' }}>Latitude</IonLabel>
                <IonInput
                  type="number"
                  value={form.current_latitude}
                  onIonChange={e => {
                    setForm({ ...form, current_latitude: parseFloat(e.detail.value!) || 0 });
                    setGpsSource('manual');
                  }}
                />
              </IonItem>
            </IonCol>
            <IonCol size="6">
              <IonItem className="premium-input-item" lines="none">
                <IonLabel position="stacked" style={{ fontWeight: 700, color: '#0F172A' }}>Longitude</IonLabel>
                <IonInput
                  type="number"
                  value={form.current_longitude}
                  onIonChange={e => {
                    setForm({ ...form, current_longitude: parseFloat(e.detail.value!) || 0 });
                    setGpsSource('manual');
                  }}
                />
              </IonItem>
            </IonCol>
          </IonRow>

          <IonItem className="premium-input-item" lines="none" style={{ marginTop: '8px' }}>
            <IonLabel position="stacked" style={{ fontWeight: 700, color: '#0F172A' }}>Inspector Notes</IonLabel>
            <IonTextarea
              rows={3}
              value={form.notes}
              onIonChange={e => setForm({ ...form, notes: e.detail.value! })}
              placeholder="Facility access details or environmental observations..."
            />
          </IonItem>

          <IonButton
            className="btn-ammoni btn-primary"
            expand="block"
            onClick={handleCreateSite}
            disabled={loading}
            style={{ marginTop: '20px' }}
          >
            {loading ? (
              <>
                <IonSpinner name="crescent" />
                &nbsp;Registering Site...
              </>
            ) : (
              <>
                <IonIcon icon={addCircleOutline} slot="start" />
                Save & Register Monitoring Site
              </>
            )}
          </IonButton>
        </IonGrid>

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMsg}
          duration={3500}
          position="bottom"
        />
      </IonContent>
    </IonModal>
  );
};

export default CreateSiteModal;
