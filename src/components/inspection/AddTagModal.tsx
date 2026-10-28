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
import UntaggedSessionList, { UntaggedSessionOption } from './UntaggedSessionList';
import { captureInspectionPhoto } from '../../services/photoStorageService';
import { createTag } from '../../services/tagService';
import offlineStorage from '../../services/OfflineStorageService';
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
  const [step, setStep] = useState<number>(0);
  const [captureSource, setCaptureSource] = useState<'new' | 'existing'>('new');
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
  const [selectedSession, setSelectedSession] = useState<UntaggedSessionOption | null>(null);

  useEffect(() => {
    if (isOpen) {
      setStep(0);
      setCaptureSource('new');
      setSelectedSession(null);
      setViolationCategory(null);
      setCaptureSummary(null);
      setTagTempId('');
      Geolocation.getCurrentPosition({ enableHighAccuracy: true })
        .then((pos) => { setLat(pos.coords.latitude); setLng(pos.coords.longitude); })
        .catch(() => {});
    }
  }, [isOpen]);

  const handleSelectExistingSession = (s: UntaggedSessionOption) => {
    setSelectedSession(s);
    setAmmonia(s.avgPpm);
    setTemp(s.avgTemp);
    setHum(s.avgHum);
    setBattery(s.avgBat);
    if (s.deviceUid) setDeviceUid(s.deviceUid);
    Geolocation.getCurrentPosition({ enableHighAccuracy: true })
      .then((pos) => { setLat(pos.coords.latitude); setLng(pos.coords.longitude); })
      .catch(() => {
        if (s.firstLat !== undefined && s.firstLng !== undefined) { setLat(s.firstLat); setLng(s.firstLng); }
      });
    setStep(3);
  };

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

  const handleCapturePhoto = async (source: CameraSource = CameraSource.Camera) => {
    const res = await captureInspectionPhoto(source);
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
      const effectiveTempId = captureSource === 'existing'
        ? `temp_tag_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
        : (tagTempId || undefined);

      await createTag({
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
        offline_temp_id: effectiveTempId,
      });

      if (captureSource === 'existing' && selectedSession && effectiveTempId) {
        const queue = await offlineStorage.getQueue();
        const otherTagIds = new Set(
          queue
            .filter((q) => (q.type === 'inspection_tag' || q.type === 'INSPECTION_TAG') && q.tempId !== effectiveTempId)
            .flatMap((t) => [t.tempId, t.payload?.temp_id, t.payload?.offline_temp_id])
            .filter(Boolean).map(String)
        );
        const tagItem = queue.find((q) => q.tempId === effectiveTempId || q.payload?.offline_temp_id === effectiveTempId);
        if (tagItem) {
          await offlineStorage.updateQueueItemPayload(tagItem.id, {
            ...tagItem.payload,
            session_id: selectedSession.sessionId,
            inspection_site_id: siteId || tagItem.payload?.inspection_site_id,
            inspection_schedule_id: scheduleId,
          });
        }
        for (const q of queue) {
          if ((q.type === 'sensor_data' || q.type === 'SENSOR_READING') && q.payload?.session_id === selectedSession.sessionId) {
            const existingTagRef = q.payload?.inspection_tag_temp_id ? String(q.payload.inspection_tag_temp_id) : '';
            if (existingTagRef && otherTagIds.has(existingTagRef)) continue;
            await offlineStorage.updateQueueItemPayload(q.id, { ...q.payload, inspection_tag_temp_id: effectiveTempId });
          }
        }
        window.dispatchEvent(new CustomEvent('tags_updated'));
        window.dispatchEvent(new CustomEvent('sync_queue_changed'));
      }

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
          <IonTitle>Add Inspection Tag {step > 0 ? `(Step ${step}/4)` : ''}</IonTitle>
          <IonButtons slot="end"><IonButton onClick={onClose}><IonIcon icon={closeOutline} /></IonButton></IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {step === 0 && (
          <div style={{ display: 'grid', gap: '12px' }}>
            <h4 style={{ margin: '0 0 4px 0', fontWeight: 700 }}>Choose Capture Source</h4>
            <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#64748B' }}>
              Start a new 5-minute sensor capture or attach a tag to an existing untagged session in the offline queue.
            </p>
            <IonButton
              expand="block"
              color="primary"
              style={{ height: '52px', fontWeight: 700 }}
              onClick={() => { setCaptureSource('new'); setStep(1); }}
            >
              New capture
            </IonButton>
            <IonButton
              expand="block"
              fill="outline"
              color="primary"
              style={{ height: '52px', fontWeight: 700 }}
              onClick={() => { setCaptureSource('existing'); setStep(1); }}
            >
              Use existing session
            </IonButton>
          </div>
        )}
        {step === 1 && captureSource === 'new' && (
          <div>
            <TagLocationStep lat={lat} lng={lng} onChangeLat={setLat} onChangeLng={setLng} onNext={() => setStep(2)} />
            <IonButton expand="block" fill="clear" color="medium" style={{ marginTop: '8px' }} onClick={() => setStep(0)}>
              <IonIcon icon={arrowBackOutline} slot="start" /> Back to Capture Source
            </IonButton>
          </div>
        )}
        {step === 1 && captureSource === 'existing' && (
          <UntaggedSessionList onSelect={handleSelectExistingSession} onBack={() => setStep(0)} />
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
            onCapture={() => handleCapturePhoto(CameraSource.Camera)}
            onPickGallery={() => handleCapturePhoto(CameraSource.Photos)}
            onBack={() => setStep(captureSource === 'existing' ? 1 : 2)}
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
