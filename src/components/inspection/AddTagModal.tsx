import React, { useState, useEffect, useCallback } from 'react';
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonIcon
} from '@ionic/react';
import { closeOutline, arrowForwardOutline, arrowBackOutline } from 'ionicons/icons';
import { Geolocation } from '@capacitor/geolocation';
import { CameraSource } from '@capacitor/camera';
import BLEConnectPanel from './BLEConnectPanel';
import SensorCaptureFlow from './SensorCaptureFlow';
import CaptureSummaryView from './CaptureSummaryView';
import TagLocationStep from './TagLocationStep';
import TagPhotoStep from './TagPhotoStep';
import TagFormReview from './TagFormReview';
import { captureInspectionPhoto } from '../../services/photoStorageService';
import { createTag } from '../../services/tagService';
import offlineStorage from '../../services/OfflineStorageService';
import { ViolationCategory, toUpperClean } from '../../types/inspection';
import { CapturedSessionReading, CaptureSummary } from '../../types/capture';
import { computeCaptureSummary } from '../../utils/captureSummary';
import { generateUUID } from '../../hooks/useSensorCaptureLoop';
import bluetoothClassicService from '../../services/bluetoothClassicService';
import { showToast } from '../../utils/toast';

const DEFAULT_LAT = 8.3683;
const DEFAULT_LNG = 124.8637;

interface Props {
  isOpen: boolean;
  onClose: () => void;
  scheduleId: number | string;
  siteId?: number | string;
  onCreated?: () => void;
}

export const AddTagModal: React.FC<Props> = ({ isOpen, onClose, scheduleId, siteId, onCreated }) => {
  const [step, setStep] = useState<number>(1);
  const [lat, setLat] = useState<number | null>(DEFAULT_LAT);
  const [lng, setLng] = useState<number | null>(DEFAULT_LNG);
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
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setTagName('');
      setNotes('');
      setPhotoDataUrl('');
      setThumbDataUrl('');
      setViolationCategory(null);
      setCaptureSummary(null);
      setTagTempId('');
      setSaveError(null);
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
    const res = await captureInspectionPhoto(CameraSource.Camera);
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
    setSaveError(null);
    try {
      const effectiveTempId = tagTempId || `temp_tag_${generateUUID()}`;
      const sessionId = captureSummary?.session_id;

      await createTag({
        tag_name: toUpperClean(tagName),
        ammonia: (ammonia !== undefined && ammonia !== null && !isNaN(Number(ammonia))) ? Number(ammonia) : 0,
        temperature: (temp !== undefined && temp !== null && !isNaN(Number(temp))) ? Number(temp) : undefined,
        humidity: (hum !== undefined && hum !== null && !isNaN(Number(hum))) ? Number(hum) : undefined,
        battery: (battery !== undefined && battery !== null && !isNaN(Number(battery))) ? Number(battery) : undefined,
        latitude: lat ?? DEFAULT_LAT,
        longitude: lng ?? DEFAULT_LNG,
        photo_url: photoDataUrl || null,
        device_uid: deviceUid,
        inspection_schedule_id: scheduleId,
        inspection_site_id: siteId || undefined,
        violation_category: violationCategory || null,
        notes: toUpperClean(notes),
        offline_temp_id: effectiveTempId,
        session_id: sessionId,
      } as any);

      if (sessionId) {
        const queue = await offlineStorage.getQueue();
        const otherTagIds = new Set(
          queue
            .filter((q) => (q.type === 'inspection_tag' || q.type === 'INSPECTION_TAG') && q.tempId !== effectiveTempId)
            .flatMap((t) => [t.tempId, t.payload?.temp_id, t.payload?.offline_temp_id])
            .filter(Boolean).map(String)
        );
        for (const q of queue) {
          if ((q.type === 'sensor_data' || q.type === 'SENSOR_READING') && q.payload?.session_id === sessionId) {
            const existingTagRef = q.payload?.inspection_tag_temp_id ? String(q.payload.inspection_tag_temp_id) : '';
            if (existingTagRef && existingTagRef !== effectiveTempId && otherTagIds.has(existingTagRef)) continue;
            if (existingTagRef !== effectiveTempId) {
              await offlineStorage.updateQueueItemPayload(q.id, { ...q.payload, inspection_tag_temp_id: effectiveTempId });
            }
          }
        }
        window.dispatchEvent(new CustomEvent('tags_updated'));
        window.dispatchEvent(new CustomEvent('sync_queue_changed'));
      }

      onCreated?.();
      showToast({ message: 'Inspection tag saved successfully!', color: 'success' });
      onClose();
    } catch (err: any) {
      const exactMsg = err?.message || String(err);
      setSaveError(exactMsg);
      showToast({ message: exactMsg, color: 'danger', duration: 5000 });
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
          <TagLocationStep lat={lat ?? DEFAULT_LAT} lng={lng ?? DEFAULT_LNG} onChangeLat={setLat} onChangeLng={setLng} onNext={() => setStep(2)} />
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
            ammonia={ammonia} temperature={temp}
            lat={lat ?? DEFAULT_LAT}
            lng={lng ?? DEFAULT_LNG}
            saving={saving}
            errorMessage={saveError}
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
