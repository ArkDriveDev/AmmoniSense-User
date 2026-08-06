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
      // Auto-fetch device GPS when modal opens if no photo captured yet
      if (!photoPreview) {
        fetchCurrentGps();
      }
    }
  }, [isOpen]);

  const fetchCurrentGps = async () => {
    setLocating(true);
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      setForm(prev => ({
        ...prev,
        current_latitude: pos.coords.latitude,
        current_longitude: pos.coords.longitude,
      }));
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
        setForm(prev => ({
          ...prev,
          current_latitude: result.latitude,
          current_longitude: result.longitude,
        }));
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
    try {
      const result = await registerSiteWithPhoto({
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
      });

      setToastMsg(`Monitoring Site "${result.site.site_name}" created successfully!`);
      setShowToast(true);

      if (onSiteCreated) onSiteCreated(result.site);

      // Reset form state
      setPhotoRecord(null);
      setPhotoPreview(null);
      onClose();
    } catch (err: any) {
      console.error('Error registering site:', err);
      setToastMsg(err.message || 'Failed to register monitoring site');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  const renderGpsBadge = () => {
    if (gpsSource === 'photo_exif') {
      return (
        <IonBadge color="success" style={{ padding: '6px 10px', borderRadius: '12px', fontSize: '11px' }}>
          <IonIcon icon={checkmarkCircleOutline} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
          Photo EXIF GPS
        </IonBadge>
      );
    } else if (gpsSource === 'device_gps') {
      return (
        <IonBadge color="primary" style={{ padding: '6px 10px', borderRadius: '12px', fontSize: '11px' }}>
          <IonIcon icon={navigateOutline} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
          Device Live GPS
        </IonBadge>
      );
    } else {
      return (
        <IonBadge color="warning" style={{ padding: '6px 10px', borderRadius: '12px', fontSize: '11px' }}>
          <IonIcon icon={warningOutline} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
          Manual Coordinates (Verify)
        </IonBadge>
      );
    }
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Create Monitoring Site</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose}>Cancel</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonGrid style={{ maxWidth: '600px', margin: '0 auto' }}>
          {/* PHOTO CAPTURE INTEGRATION SECTION */}
          <IonCard style={{ margin: '0 0 16px 0', border: '1px dashed #cbd5e1', boxShadow: 'none', background: '#f8fafc' }}>
            <IonCardContent className="ion-text-center">
              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#475569', display: 'block', marginBottom: '8px' }}>
                Site Entrance / Facility Photo (GPS Auto-Fill)
              </span>

              {photoPreview ? (
                <div style={{ position: 'relative', display: 'inline-block', width: '100%', maxHeight: '200px', overflow: 'hidden', borderRadius: '8px' }}>
                  <img
                    src={photoPreview}
                    alt="Captured Site"
                    style={{ width: '100%', height: '180px', objectFit: 'cover', borderRadius: '8px' }}
                  />
                  <IonButton
                    size="small"
                    color="light"
                    onClick={handleTakeSitePhoto}
                    disabled={capturingPhoto}
                    style={{ position: 'absolute', bottom: '8px', right: '8px', opacity: 0.9 }}
                  >
                    <IonIcon icon={cameraOutline} slot="start" />
                    Retake Photo
                  </IonButton>
                </div>
              ) : (
                <div style={{ padding: '16px 0' }}>
                  <IonIcon icon={imageOutline} style={{ fontSize: '42px', color: '#94a3b8' }} />
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '6px 0 12px 0' }}>
                    Take a photo to embed EXIF GPS coordinates directly into site registration
                  </p>
                  <IonButton fill="outline" color="primary" onClick={handleTakeSitePhoto} disabled={capturingPhoto}>
                    {capturingPhoto ? (
                      <>
                        <IonSpinner name="crescent" />
                        &nbsp;Opening Camera...
                      </>
                    ) : (
                      <>
                        <IonIcon icon={cameraOutline} slot="start" />
                        Capture Site Photo & Extract GPS
                      </>
                    )}
                  </IonButton>
                </div>
              )}
            </IonCardContent>
          </IonCard>

          <IonItem lines="full">
            <IonLabel position="stacked">Site Code</IonLabel>
            <IonInput
              value={form.site_code}
              onIonChange={e => setForm({ ...form, site_code: e.detail.value! })}
              placeholder="e.g. SITE-2026-001"
            />
          </IonItem>

          <IonItem lines="full">
            <IonLabel position="stacked">Site Name *</IonLabel>
            <IonInput
              value={form.site_name}
              onIonChange={e => setForm({ ...form, site_name: e.detail.value! })}
              placeholder="e.g. Silang Livestock Farm - Site A"
            />
          </IonItem>

          <IonItem lines="full">
            <IonLabel position="stacked">Site Category / Type</IonLabel>
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

          <IonItem lines="full">
            <IonLabel position="stacked">Address / Location Description</IonLabel>
            <IonInput
              value={form.address}
              onIonChange={e => setForm({ ...form, address: e.detail.value! })}
              placeholder="e.g. Brgy. San Pedro, Silang, Cavite"
            />
          </IonItem>

          <IonRow>
            <IonCol size="6">
              <IonItem lines="full">
                <IonLabel position="stacked">Area Size (Hectares)</IonLabel>
                <IonInput
                  type="number"
                  value={form.area_size_hectares}
                  onIonChange={e => setForm({ ...form, area_size_hectares: e.detail.value! })}
                />
              </IonItem>
            </IonCol>
            <IonCol size="6">
              <IonItem lines="full">
                <IonLabel position="stacked">Initial Grid Cell</IonLabel>
                <IonInput
                  value={form.current_grid_cell_id}
                  onIonChange={e => setForm({ ...form, current_grid_cell_id: e.detail.value! })}
                />
              </IonItem>
            </IonCol>
          </IonRow>

          {/* GPS Coordinates Header & Source Status */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '16px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b' }}>
                GPS Location
              </span>
              {renderGpsBadge()}
            </div>
            <IonButton fill="clear" size="small" onClick={fetchCurrentGps} disabled={locating}>
              <IonIcon icon={locateOutline} slot="start" />
              {locating ? 'Acquiring...' : 'Refetch GPS'}
            </IonButton>
          </div>

          <IonRow>
            <IonCol size="6">
              <IonItem lines="full">
                <IonLabel position="stacked">Latitude</IonLabel>
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
              <IonItem lines="full">
                <IonLabel position="stacked">Longitude</IonLabel>
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

          <IonItem lines="full" style={{ marginTop: '12px' }}>
            <IonLabel position="stacked">Inspector Notes (Optional)</IonLabel>
            <IonTextarea
              rows={3}
              value={form.notes}
              onIonChange={e => setForm({ ...form, notes: e.detail.value! })}
              placeholder="e.g. Proximity to river stream: 50m. Inspection access via main gate."
            />
          </IonItem>

          <IonButton
            expand="block"
            color="primary"
            size="large"
            onClick={handleCreateSite}
            disabled={loading}
            style={{ marginTop: '24px', fontWeight: 'bold' }}
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
