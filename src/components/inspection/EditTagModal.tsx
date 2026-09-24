import React, { useState, useEffect } from 'react';
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonItem, IonLabel, IonInput, IonTextarea, IonSpinner, IonIcon,
  IonBadge, IonAlert
} from '@ionic/react';
import {
  closeOutline, checkmarkCircleOutline, thermometerOutline, waterOutline,
  batteryChargingOutline, locationOutline, cameraOutline, trashOutline
} from 'ionicons/icons';
import { updateTag, deleteTag } from '../../services/tagService';
import { InspectionTag, toUpperClean } from '../../types/inspection';
import { captureImageWithCameraOrFallback, dataURLtoBlob } from '../../utils/photoUtils';
import { uploadTagPhoto } from '../../services/photoStorageService';
import { createThumbnail } from '../../utils/thumbnailUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tag: InspectionTag | null;
  onUpdated?: () => void;
  onDeleted?: () => void;
}

export const EditTagModal: React.FC<Props> = ({ isOpen, onClose, tag, onUpdated, onDeleted }) => {
  const [tagName, setTagName] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteAlert, setShowDeleteAlert] = useState(false);
  const [capturingPhoto, setCapturingPhoto] = useState(false);
  const [newPhotoDataUrl, setNewPhotoDataUrl] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && tag) {
      setTagName(tag.tag_name || '');
      setNotes(tag.notes || '');
      setNewPhotoDataUrl(null);
    }
  }, [isOpen, tag]);

  if (!tag) return null;

  const displayPhoto = newPhotoDataUrl || tag.photo_thumbnail_url || tag.photo_url;

  const handleRetakePhoto = async () => {
    setCapturingPhoto(true);
    try {
      const dataUrl = await captureImageWithCameraOrFallback();
      setNewPhotoDataUrl(dataUrl);
    } catch (err: any) {
      if (!err?.message?.toLowerCase().includes('cancel')) {
        alert(err.message || 'Camera capture failed');
      }
    } finally {
      setCapturingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!tagName.trim()) return alert('Please enter a tag name');
    setSaving(true);
    try {
      const updates: Parameters<typeof updateTag>[1] = {
        tag_name: toUpperClean(tagName),
        notes: toUpperClean(notes),
      };

      // Upload new photo if one was captured
      if (newPhotoDataUrl) {
        try {
          const blob = dataURLtoBlob(newPhotoDataUrl);
          const thumbDataUrl = await createThumbnail(newPhotoDataUrl);
          const thumbBlob = thumbDataUrl ? dataURLtoBlob(thumbDataUrl) : null;
          const siteId = tag.inspection_site_id ?? 0;
          const uploaded = await uploadTagPhoto(blob, thumbBlob, tag.id, siteId);

          updates.photo_url = uploaded.photo_url;
          updates.photo_thumbnail_url = uploaded.photo_thumbnail_url;
          updates.photo_storage_path = uploaded.photo_storage_path;
          updates.photo_thumbnail_storage_path = uploaded.photo_thumbnail_storage_path;
          // Pass old paths so tagService can delete them from bucket
          updates._old_photo_storage_path = (tag as any).photo_storage_path ?? null;
          updates._old_photo_thumbnail_storage_path = (tag as any).photo_thumbnail_storage_path ?? null;
        } catch (photoErr) {
          console.warn('[EditTagModal] Photo upload failed, saving other fields only:', photoErr);
        }
      }

      await updateTag(tag.id, updates);
      onUpdated?.();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to update tag');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteTag(tag.id);
      onDeleted?.();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to delete tag');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <IonModal isOpen={isOpen} onDidDismiss={onClose}>
        <IonHeader>
          <IonToolbar style={{ '--background': 'linear-gradient(135deg, #0F3C5C 0%, #1D5D9B 100%)', '--color': '#ffffff' }}>
            <IonTitle>Update Tag Details</IonTitle>
            <IonButtons slot="end">
              <IonButton onClick={onClose} style={{ color: '#ffffff' }}><IonIcon icon={closeOutline} /></IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding" style={{ '--background': '#F8FAFC' }}>

          {/* Photo Section */}
          <div style={{ position: 'relative', marginBottom: '16px', borderRadius: '12px', overflow: 'hidden', background: '#E2E8F0', height: '170px' }}>
            {displayPhoto ? (
              <img
                src={displayPhoto}
                alt={tag.tag_name}
                style={{ width: '100%', height: '170px', objectFit: 'cover' }}
              />
            ) : (
              <div style={{ height: '170px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '13px', flexDirection: 'column', gap: '6px' }}>
                <IonIcon icon={cameraOutline} style={{ fontSize: '32px' }} />
                No photo
              </div>
            )}
            <IonButton
              size="small"
              color="light"
              onClick={handleRetakePhoto}
              disabled={capturingPhoto || saving}
              style={{ position: 'absolute', bottom: '8px', right: '8px', fontWeight: 700 }}
            >
              {capturingPhoto ? <IonSpinner name="crescent" /> : <><IonIcon icon={cameraOutline} slot="start" />{displayPhoto ? 'Retake' : 'Add Photo'}</>}
            </IonButton>
            {newPhotoDataUrl && (
              <IonBadge style={{ position: 'absolute', top: '8px', left: '8px', background: '#10B981', color: '#fff', fontSize: '10px' }}>
                New photo — unsaved
              </IonBadge>
            )}
          </div>

          {/* Sensor readings (read-only) */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px', background: '#ffffff', padding: '12px', borderRadius: '10px', border: '1px solid #E2E8F0', fontSize: '12px', color: '#475569' }}>
            <IonBadge color="primary">{(Number(tag.ammonia) || 0).toFixed(2)} PPM ({tag.status})</IonBadge>
            <span><IonIcon icon={thermometerOutline} /> {(Number(tag.temperature) || 0).toFixed(1)}°C</span>
            <span><IonIcon icon={waterOutline} /> {(Number(tag.humidity) || 0).toFixed(1)}%</span>
            <span><IonIcon icon={batteryChargingOutline} /> {tag.battery ?? 100}%</span>
            <span><IonIcon icon={locationOutline} /> {(Number(tag.latitude) || 0).toFixed(4)}, {(Number(tag.longitude) || 0).toFixed(4)}</span>
          </div>

          <IonItem lines="inset" style={{ '--background': '#ffffff', borderRadius: '8px' }}>
            <IonLabel position="stacked">TAG NAME *</IonLabel>
            <IonInput value={tagName} onIonInput={(e) => setTagName(toUpperClean(e.detail.value!))} placeholder="TAG IDENTIFIER" />
          </IonItem>

          <IonItem lines="inset" style={{ marginTop: '12px', '--background': '#ffffff', borderRadius: '8px' }}>
            <IonLabel position="stacked">NOTES</IonLabel>
            <IonTextarea rows={3} value={notes} onIonInput={(e) => setNotes(toUpperClean(e.detail.value!))} placeholder="OBSERVATIONS OR REASON..." />
          </IonItem>

          {/* Actions */}
          <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <IonButton
              expand="block"
              onClick={handleSave}
              disabled={saving || deleting}
              style={{ '--background': 'linear-gradient(135deg, #0F3C5C 0%, #1D5D9B 100%)', fontWeight: 700 }}
            >
              {saving ? <IonSpinner name="crescent" /> : <><IonIcon icon={checkmarkCircleOutline} slot="start" />Save Changes</>}
            </IonButton>

            <IonButton
              expand="block"
              color="danger"
              fill="outline"
              onClick={() => setShowDeleteAlert(true)}
              disabled={saving || deleting}
              style={{ fontWeight: 700 }}
            >
              {deleting ? <IonSpinner name="crescent" /> : <><IonIcon icon={trashOutline} slot="start" />Delete Tag</>}
            </IonButton>
          </div>
        </IonContent>
      </IonModal>

      <IonAlert
        isOpen={showDeleteAlert}
        onDidDismiss={() => setShowDeleteAlert(false)}
        header="Delete Tag?"
        message={`This will permanently delete "${tag.tag_name}" and its photo. This cannot be undone.`}
        buttons={[
          { text: 'Cancel', role: 'cancel' },
          { text: 'Delete', role: 'destructive', handler: handleDelete },
        ]}
      />
    </>
  );
};
export default EditTagModal;
