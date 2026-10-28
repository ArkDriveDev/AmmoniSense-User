import React, { useEffect, useState } from 'react';
import {
  IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonInput, IonItem, IonLabel, IonSelect, IonSelectOption, IonTextarea,
} from '@ionic/react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import offlineStorage from '../../services/OfflineStorageService';
import { VIOLATION_CATEGORIES } from '../../constants/violationCategories';
import { ViolationCategory } from '../../types/inspection';
import { createThumbnail } from '../../utils/thumbnailUtils';
import { SessionGroup } from '../../pages/user/RecoveryScreen';

export interface RecoveryFormValues {
  siteId: string | number;
  scheduleId: string | number;
  tagName: string;
  violationCategory: ViolationCategory | null;
  notes: string;
  photoDataUrl: string | null;
  thumbDataUrl: string | null;
}

interface Props {
  session: SessionGroup;
  usageRatio: number;
  onCancel: () => void;
  onSave: (values: RecoveryFormValues) => Promise<void>;
}

const RecoveryTagForm: React.FC<Props> = ({ session, usageRatio, onCancel, onSave }) => {
  const [sites, setSites] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [siteId, setSiteId] = useState<string | number>('');
  const [scheduleId, setScheduleId] = useState<string | number>('');
  const [tagName, setTagName] = useState(`RECOVERY TAG ${session.sessionId.slice(0, 8).toUpperCase()}`);
  const [violationCategory, setViolationCategory] = useState<ViolationCategory | null>(null);
  const [notes, setNotes] = useState('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [thumbDataUrl, setThumbDataUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const quotaExceeded = usageRatio > 0.9;

  useEffect(() => { offlineStorage.getAllSitesFromIDB().then(setSites).catch(() => setSites([])); }, []);
  useEffect(() => {
    setScheduleId('');
    if (!siteId) { setSchedules([]); return; }
    offlineStorage.getAllSchedulesFromIDB(siteId).then(setSchedules).catch(() => setSchedules([]));
  }, [siteId]);

  const pickPhoto = async (source: CameraSource) => {
    try {
      const photo = await Camera.getPhoto({ quality: 80, allowEditing: false, resultType: CameraResultType.DataUrl, source });
      if (!photo.dataUrl) return;
      const thumb = await createThumbnail(photo.dataUrl);
      setPhotoDataUrl(photo.dataUrl);
      setThumbDataUrl(thumb);
    } catch { /* cancelled */ }
  };

  const handleSubmit = async (skipPhoto = false) => {
    if (!siteId || !scheduleId || !tagName.trim()) return;
    setSaving(true);
    try {
      await onSave({
        siteId, scheduleId, tagName, violationCategory, notes,
        photoDataUrl: skipPhoto || quotaExceeded ? null : photoDataUrl,
        thumbDataUrl: skipPhoto || quotaExceeded ? null : thumbDataUrl,
      });
    } finally { setSaving(false); }
  };

  return (
    <IonCard style={{ border: '2px solid #1D5D9B' }}>
      <IonCardHeader><IonCardTitle style={{ fontSize: '16px', fontWeight: 700 }}>3. Create Tag — Session {session.sessionId.slice(0, 8)}</IonCardTitle></IonCardHeader>
      <IonCardContent style={{ display: 'grid', gap: '8px' }}>
        <IonItem>
          <IonLabel position="stacked">Site *</IonLabel>
          <IonSelect value={siteId} placeholder="Select site" onIonChange={(e) => setSiteId(e.detail.value)}>
            {sites.map((s) => {
              const id = s.offline_temp_id || s.id;
              return <IonSelectOption key={String(id)} value={id}>{s.site_name || s.name || id} {(s.isOffline || String(id).startsWith('temp_')) ? '(Offline — not synced)' : ''}</IonSelectOption>;
            })}
          </IonSelect>
        </IonItem>
        {siteId && schedules.length === 0 && <div style={{ color: '#DC2626', fontSize: '13px', padding: '0 8px' }}>No schedules for this site — create one first.</div>}
        <IonItem>
          <IonLabel position="stacked">Schedule *</IonLabel>
          <IonSelect value={scheduleId} placeholder="Select schedule" disabled={!siteId || schedules.length === 0} onIonChange={(e) => setScheduleId(e.detail.value)}>
            {schedules.map((sc) => {
              const id = sc.offline_temp_id || sc.id;
              return <IonSelectOption key={String(id)} value={id}>{sc.schedule_name || id} ({sc.scheduled_date || ''}) {(sc.isOffline || String(id).startsWith('temp_')) ? '[Offline]' : ''}</IonSelectOption>;
            })}
          </IonSelect>
        </IonItem>
        <IonItem><IonLabel position="stacked">Tag Name *</IonLabel><IonInput value={tagName} onIonInput={(e) => setTagName(String(e.detail.value || ''))} /></IonItem>
        <IonItem>
          <IonLabel position="stacked">Violation Category</IonLabel>
          <IonSelect value={violationCategory} placeholder="None" onIonChange={(e) => setViolationCategory(e.detail.value || null)}>
            <IonSelectOption value={null}>None</IonSelectOption>
            {VIOLATION_CATEGORIES.map((c) => <IonSelectOption key={c.value} value={c.value}>{c.label}</IonSelectOption>)}
          </IonSelect>
        </IonItem>
        <IonItem><IonLabel position="stacked">Notes</IonLabel><IonTextarea value={notes} rows={2} onIonInput={(e) => setNotes(String(e.detail.value || ''))} /></IonItem>
        {quotaExceeded ? (
          <div style={{ color: '#DC2626', fontSize: '13px', padding: '4px 8px', fontWeight: 600 }}>
            Storage usage &gt; 90%. Photo attach disabled — tag will be saved without a photo.
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '4px 0' }}>
            <IonButton size="small" fill="outline" onClick={() => pickPhoto(CameraSource.Photos)}>Pick from Gallery</IonButton>
            <IonButton size="small" fill="outline" onClick={() => pickPhoto(CameraSource.Camera)}>Take Photo</IonButton>
            {thumbDataUrl && (
              <img src={thumbDataUrl} alt="Preview" style={{ width: '44px', height: '44px', objectFit: 'cover', borderRadius: '6px' }} />
            )}
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
          <IonButton expand="block" disabled={!siteId || !scheduleId || !tagName.trim() || saving} onClick={() => handleSubmit(false)}>{saving ? 'Saving…' : 'Save Tag to Queue'}</IonButton>
          {photoDataUrl && !quotaExceeded && (
            <IonButton fill="outline" color="warning" disabled={saving} onClick={() => handleSubmit(true)}>Save Without Photo</IonButton>
          )}
          <IonButton fill="outline" color="medium" onClick={onCancel}>Cancel</IonButton>
        </div>
      </IonCardContent>
    </IonCard>
  );
};

export default RecoveryTagForm;
