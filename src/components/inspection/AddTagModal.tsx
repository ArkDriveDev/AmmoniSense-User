import React, { useState, useEffect, useCallback } from 'react';
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonIcon
} from '@ionic/react';
import { closeOutline, arrowForwardOutline, arrowBackOutline } from 'ionicons/icons';
import { Geolocation } from '@capacitor/geolocation';
import BLEConnectPanel from './BLEConnectPanel';
import SensorCaptureFlow from './SensorCaptureFlow';
import CaptureSummaryView from './CaptureSummaryView';
import TagLocationStep from './TagLocationStep';
import TagPhotoStep from './TagPhotoStep';
import TagFormReview from './TagFormReview';
import { captureInspectionPhoto } from '../../services/photoStorageService';
import { createTag } from '../../services/tagService';
import { ViolationCategory, toUpperClean } from '../../types/inspection';
import { CapturedSessionReading, CaptureSummary } from '../../types/capture';
import { computeCaptureSummary } from '../../utils/captureSummary';
import bluetoothClassicService from '../../services/bluetoothClassicService';
import { showToast } from '../../utils/toast';

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
  const [ammonia, setAmmonia] = useState<number | null>(null);
  const [temp, setTemp] = useState<number | null>(null);
  const [hum, setHum] = useState<number | null>(null);
  const [battery, setBattery] = useState<number | null>(null);
  const [deviceUid, setDeviceUid] = useState<string>(bluetoothClassicService.getDeviceUid() || '');
  const [photoDataUrl, setPhotoDataUrl] = useState<string>('');
  const [thumbDataUrl, setThumbDataUrl] = useState<string>('');
  const [tagName, setTagName] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [violationCategory, setViolationCategory] = useState<ViolationCategory | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [captureSummary, setCaptureSummary] = useState<CaptureSummary | null>(null);
  const [tagTempId, setTagTempId] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setViolationCategory(null);
      setCaptureSummary(null);
      setTagTempId('');
      Geolocation.getCurrentPosition({ enableHighAccuracy: true })
        .then((pos) => { setLat(pos.coords.latitude); setLng(pos.coords.longitude); })
        .catch(() => {});
    }
  }, [isOpen]);

  const handleCaptureComplete = useCallback((readings: CapturedSessionReading[], sessionId: string, tempId: string) => {
    const sum = computeCaptureSummary(readings, sessionId, tempId);
    setCaptureSummary(sum);
    setTagTempId(tempId);
    setAmmonia(sum.avg_ppm);
    if (readings.length > 0) {
      const last = readings[readings.length - 1];
      if (last.temperature !== null) setTemp(last.temperature);
      if (last.humidity !== null) setHum(last.humidity);
      if (last.battery_percent !== null) setBattery(last.battery_percent);
    }
  }, []);

  const handleCapturePhoto = async () => {
    const res = await captureInspectionPhoto();
    if (res) {
      setPhotoDataUrl(res.dataUrl);
      setThumbDataUrl(res.thumbnailDataUrl);
    }
  };

  const handleSave = async () => {
    if (!tagName.trim()) return alert('Please enter a TAG NAME');
    if (violationCategory === 'OTHERS' && !notes.trim()) {
      return alert('Please specify violation details in NOTES when category is "OTHERS"');
    }
    setSaving(true);
    try {
      // 1. Create tag record first to obtain its numeric database ID
      const createdTag = await createTag({
        tag_name: toUpperClean(tagName),
        ammonia: (ammonia !== undefined && ammonia !== null && !isNaN(Number(ammonia))) ? Number(ammonia) : 0,
        temperature: (temp !== undefined && temp !== null && !isNaN(Number(temp))) ? Number(temp) : undefined,
        humidity: (hum !== undefined && hum !== null && !isNaN(Number(hum))) ? Number(hum) : undefined,
        battery: (battery !== undefined && battery !== null && !isNaN(Number(battery))) ? Number(battery) : undefined,
        latitude: lat,
        longitude: lng,
        photo_url: photoDataUrl || null,
        photo_thumbnail_url: thumbDataUrl || null,
        device_uid: deviceUid,
        inspection_schedule_id: scheduleId,
        inspection_site_id: siteId || undefined,
        violation_category: violationCategory || null,
        notes: toUpperClean(notes),
        offline_temp_id: tagTempId || undefined,
      });

      onCreated?.();
      showToast({ message: 'Inspection tag saved successfully!', color: 'success' });
      onClose();
    } catch (err: any) {
      showToast({ message: err.message || 'Failed to save tag', color: 'danger' });
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
            <h4 style={{ margin: '0 0 12px 0' }}>Step 2: AmmoniSense Sensor Reading</h4>
            <BLEConnectPanel onReadingCaptured={(r) => { if (!captureSummary) { setAmmonia(r.ammonia); setTemp(r.temperature); setHum(r.humidity); setBattery(r.battery); } if (r.device_uid) setDeviceUid(r.device_uid); }} />
            {!captureSummary ? (
              <SensorCaptureFlow isConnected={bluetoothClassicService.getStatus() === 'connected'} onComplete={handleCaptureComplete} />
            ) : (
              <CaptureSummaryView summary={captureSummary} />
            )}
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
              <IonButton fill="outline" onClick={() => setStep(1)}><IonIcon icon={arrowBackOutline} /></IonButton>
              {captureSummary && (
                <IonButton expand="block" style={{ flex: 1 }} onClick={() => setStep(3)}>Next: Photo <IonIcon icon={arrowForwardOutline} slot="end" /></IonButton>
              )}
            </div>
          </div>
        )}
        {step === 3 && (
          <TagPhotoStep
            photoDataUrl={photoDataUrl}
            onCapture={handleCapturePhoto}
            onBack={() => setStep(2)}
            onNext={() => setStep(4)}
          />
        )}
        {step === 4 && (
          <TagFormReview
            tagName={tagName} notes={notes} violationCategory={violationCategory}
            ammonia={ammonia} temperature={temp} lat={lat} lng={lng} saving={saving}
            onChangeTagName={setTagName} onChangeNotes={setNotes}
            onChangeViolationCategory={setViolationCategory}
            onBack={() => setStep(3)} onSave={handleSave}
          />
        )}
      </IonContent>
    </IonModal>
  );
};
export default AddTagModal;
