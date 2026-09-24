import React, { useState, useEffect } from 'react';
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonIcon
} from '@ionic/react';
import { closeOutline, cameraOutline, arrowForwardOutline, arrowBackOutline } from 'ionicons/icons';
import { Geolocation } from '@capacitor/geolocation';
import BLEConnectPanel from './BLEConnectPanel';
import TagLocationStep from './TagLocationStep';
import TagFormReview from './TagFormReview';
import { captureInspectionPhoto, uploadPhotoPair } from '../../services/photoStorageService';
import { createTag } from '../../services/tagService';
import { toUpperClean } from '../../types/inspection';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  scheduleId: number | string;
  siteId?: number | string;
  onCreated?: () => void;
}

export const AddTagModal: React.FC<Props> = ({ isOpen, onClose, scheduleId, siteId, onCreated }) => {
  const [step, setStep] = useState<number>(1);
  const [lat, setLat] = useState<number>(8.3683);
  const [lng, setLng] = useState<number>(124.8637);
  const [ammonia, setAmmonia] = useState<number>(0);
  const [temp, setTemp] = useState<number>(25);
  const [hum, setHum] = useState<number>(60);
  const [battery, setBattery] = useState<number>(100);
  const [deviceUid, setDeviceUid] = useState<string>('');
  const [photoDataUrl, setPhotoDataUrl] = useState<string>('');
  const [thumbDataUrl, setThumbDataUrl] = useState<string>('');
  const [tagName, setTagName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      Geolocation.getCurrentPosition({ enableHighAccuracy: true })
        .then((pos) => { setLat(pos.coords.latitude); setLng(pos.coords.longitude); })
        .catch(() => {});
    }
  }, [isOpen]);

  const handleCapturePhoto = async () => {
    const res = await captureInspectionPhoto();
    if (res) {
      setPhotoDataUrl(res.dataUrl);
      setThumbDataUrl(res.thumbnailDataUrl);
    }
  };

  const handleSave = async () => {
    if (!tagName.trim()) return alert('Please enter a TAG NAME');
    setSaving(true);
    try {
      let pUrl = photoDataUrl;
      let tUrl = thumbDataUrl;
      let pPath: string | null = null;
      let tPath: string | null = null;
      if (photoDataUrl) {
        const cleanName = toUpperClean(tagName) || 'TAG';
        const siteRef = siteId || 'general';
        const uploaded = await uploadPhotoPair(photoDataUrl, thumbDataUrl, cleanName, siteRef);
        pUrl = uploaded.photoUrl;
        tUrl = uploaded.thumbnailUrl;
        pPath = uploaded.photo_storage_path || null;
        tPath = uploaded.photo_thumbnail_storage_path || null;
      }
      await createTag({
        tag_name: toUpperClean(tagName),
        ammonia: (ammonia !== undefined && !isNaN(Number(ammonia))) ? Number(ammonia) : 0,
        temperature: (temp !== undefined && !isNaN(Number(temp))) ? Number(temp) : 0,
        humidity: (hum !== undefined && !isNaN(Number(hum))) ? Number(hum) : 0,
        battery: (battery !== undefined && !isNaN(Number(battery))) ? Number(battery) : 100,
        latitude: lat,
        longitude: lng,
        photo_url: pUrl,
        photo_thumbnail_url: tUrl,
        photo_storage_path: pPath,
        photo_thumbnail_storage_path: tPath,
        device_uid: deviceUid,
        inspection_schedule_id: scheduleId,
        inspection_site_id: siteId || undefined,
        notes: toUpperClean(notes),
      });
      onCreated?.();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to save tag');
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>Add Inspection Tag (Step {step}/4)</IonTitle>
          <IonButtons slot="end"><IonButton onClick={onClose}><IonIcon icon={closeOutline} /></IonButton></IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {step === 1 && (
          <TagLocationStep lat={lat} lng={lng} onChangeLat={setLat} onChangeLng={setLng} onNext={() => setStep(2)} />
        )}
        {step === 2 && (
          <div>
            <h4 style={{ margin: '0 0 12px 0' }}>Step 2: BLE Sensor Reading</h4>
            <BLEConnectPanel onReadingCaptured={(r) => { setAmmonia(r.ammonia); setTemp(r.temperature); setHum(r.humidity); setBattery(r.battery); if (r.device_uid) setDeviceUid(r.device_uid); }} />
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <IonButton fill="outline" onClick={() => setStep(1)}><IonIcon icon={arrowBackOutline} /></IonButton>
              <IonButton expand="block" style={{ flex: 1 }} onClick={() => setStep(3)}>Next: Photo <IonIcon icon={arrowForwardOutline} slot="end" /></IonButton>
            </div>
          </div>
        )}
        {step === 3 && (
          <div>
            <h4 style={{ margin: '0 0 12px 0' }}>Step 3: Tag Photo</h4>
            {photoDataUrl ? (
              <div style={{ textAlign: 'center' }}>
                <img src={photoDataUrl} alt="Preview" style={{ maxHeight: '200px', borderRadius: '10px' }} />
                <IonButton expand="block" fill="outline" style={{ marginTop: '10px' }} onClick={handleCapturePhoto}><IonIcon icon={cameraOutline} slot="start" /> Retake Photo</IonButton>
              </div>
            ) : (
              <IonButton expand="block" style={{ height: '56px' }} onClick={handleCapturePhoto}><IonIcon icon={cameraOutline} slot="start" /> Take Tag Photo</IonButton>
            )}
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <IonButton fill="outline" onClick={() => setStep(2)}><IonIcon icon={arrowBackOutline} /></IonButton>
              <IonButton expand="block" style={{ flex: 1 }} onClick={() => setStep(4)}>Next: Details <IonIcon icon={arrowForwardOutline} slot="end" /></IonButton>
            </div>
          </div>
        )}
        {step === 4 && (
          <TagFormReview
            tagName={tagName} notes={notes} ammonia={ammonia} temperature={temp}
            lat={lat} lng={lng} saving={saving}
            onChangeTagName={setTagName} onChangeNotes={setNotes}
            onBack={() => setStep(3)} onSave={handleSave}
          />
        )}
      </IonContent>
    </IonModal>
  );
};
export default AddTagModal;
