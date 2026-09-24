import React, { useState, useEffect } from 'react';
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonItem, IonLabel, IonInput, IonTextarea, IonSpinner, IonIcon,
  IonBadge
} from '@ionic/react';
import { closeOutline, checkmarkCircleOutline, thermometerOutline, waterOutline, batteryChargingOutline, locationOutline } from 'ionicons/icons';
import { updateTag } from '../../services/tagService';
import { InspectionTag, toUpperClean } from '../../types/inspection';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tag: InspectionTag | null;
  onUpdated?: () => void;
}

export const EditTagModal: React.FC<Props> = ({ isOpen, onClose, tag, onUpdated }) => {
  const [tagName, setTagName] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && tag) {
      setTagName(tag.tag_name || '');
      setNotes(tag.notes || '');
    }
  }, [isOpen, tag]);

  if (!tag) return null;

  const photo = tag.photo_thumbnail_url || tag.photo_url;

  const handleSave = async () => {
    if (!tagName.trim()) return alert('Please enter a tag name');
    setSaving(true);
    try {
      await updateTag(tag.id, {
        tag_name: toUpperClean(tagName),
        notes: toUpperClean(notes),
      });
      onUpdated?.();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to update tag');
    } finally {
      setSaving(false);
    }
  };

  return (
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
        {photo && (
          <div style={{ textAlign: 'center', marginBottom: '16px' }}>
            <img
              src={photo}
              alt={tag.tag_name}
              style={{ maxHeight: '160px', width: '100%', objectFit: 'cover', borderRadius: '12px' }}
            />
          </div>
        )}

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

        <div style={{ marginTop: '24px' }}>
          <IonButton expand="block" onClick={handleSave} disabled={saving} style={{ '--background': 'linear-gradient(135deg, #0F3C5C 0%, #1D5D9B 100%)', fontWeight: 700 }}>
            {saving ? <IonSpinner name="crescent" /> : <><IonIcon icon={checkmarkCircleOutline} slot="start" /> Update Tag Details</>}
          </IonButton>
        </div>
      </IonContent>
    </IonModal>
  );
};
export default EditTagModal;
