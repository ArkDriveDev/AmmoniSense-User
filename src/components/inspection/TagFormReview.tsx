import React, { useEffect, useState } from 'react';
import { IonItem, IonLabel, IonInput, IonTextarea, IonButton, IonIcon, IonSpinner, IonSelect, IonSelectOption } from '@ionic/react';
import { arrowBackOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { ViolationCategory, toUpperClean } from '../../types/inspection';
import { VIOLATION_CATEGORIES } from '../../constants/violationCategories';
import offlineStorage from '../../services/OfflineStorageService';

interface Props {
  tagName: string;
  notes: string;
  violationCategory: ViolationCategory | null;
  ammonia: number | null;
  temperature: number | null;
  lat: number;
  lng: number;
  saving: boolean;
  showSiteSchedulePickers?: boolean;
  selectedSiteId?: number | string;
  selectedScheduleId?: number | string;
  onChangeSiteId?: (v: number | string) => void;
  onChangeScheduleId?: (v: number | string) => void;
  onChangeTagName: (v: string) => void;
  onChangeNotes: (v: string) => void;
  onChangeViolationCategory: (v: ViolationCategory | null) => void;
  onBack: () => void;
  onSave: () => void;
}

export const TagFormReview: React.FC<Props> = ({
  tagName, notes, violationCategory, ammonia, temperature, lat, lng, saving,
  showSiteSchedulePickers, selectedSiteId, selectedScheduleId, onChangeSiteId, onChangeScheduleId,
  onChangeTagName, onChangeNotes, onChangeViolationCategory, onBack, onSave
}) => {
  const [sites, setSites] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);

  useEffect(() => {
    if (!showSiteSchedulePickers) return;
    offlineStorage.getAllSitesFromIDB().then(setSites).catch(() => setSites([]));
  }, [showSiteSchedulePickers]);

  useEffect(() => {
    if (!showSiteSchedulePickers || !selectedSiteId) { setSchedules([]); return; }
    offlineStorage.getAllSchedulesFromIDB(selectedSiteId).then(setSchedules).catch(() => setSchedules([]));
  }, [showSiteSchedulePickers, selectedSiteId]);

  return (
  <div>
    <h4 style={{ margin: '0 0 12px 0' }}>Step 4: Tag Name & Review</h4>
    {showSiteSchedulePickers && (
      <>
        <IonItem lines="inset" style={{ marginBottom: '8px' }}>
          <IonLabel position="stacked">SITE *</IonLabel>
          <IonSelect value={selectedSiteId || ''} placeholder="Select Site" onIonChange={(e) => { onChangeSiteId?.(e.detail.value); onChangeScheduleId?.(''); }}>
            {sites.map((s) => {
              const id = s.offline_temp_id || s.id;
              return <IonSelectOption key={String(id)} value={id}>{s.site_name || id} {(s.isOffline || String(id).startsWith('temp_')) ? '(Offline)' : ''}</IonSelectOption>;
            })}
          </IonSelect>
        </IonItem>
        <IonItem lines="inset" style={{ marginBottom: '8px' }}>
          <IonLabel position="stacked">SCHEDULE *</IonLabel>
          <IonSelect value={selectedScheduleId || ''} placeholder="Select Schedule" disabled={!selectedSiteId || schedules.length === 0} onIonChange={(e) => onChangeScheduleId?.(e.detail.value)}>
            {schedules.map((sc) => {
              const id = sc.offline_temp_id || sc.id;
              return <IonSelectOption key={String(id)} value={id}>{sc.schedule_name || id} ({sc.scheduled_date || ''})</IonSelectOption>;
            })}
          </IonSelect>
        </IonItem>
      </>
    )}
    <IonItem lines="inset">
      <IonLabel position="stacked">TAG NAME * (AUTO-UPPERCASE)</IonLabel>
      <IonInput value={tagName} placeholder="E.G. PEN 1 CORNER A" onIonInput={(e) => onChangeTagName(toUpperClean(e.detail.value!))} />
    </IonItem>
    <IonItem lines="inset" style={{ marginTop: '8px' }}>
      <IonLabel position="stacked">VIOLATION CATEGORY (MENRO)</IonLabel>
      <IonSelect
        value={violationCategory || ''}
        placeholder="Select Category (Optional)"
        interface="alert"
        onIonChange={(e) => onChangeViolationCategory(e.detail.value ? (e.detail.value as ViolationCategory) : null)}
      >
        <IonSelectOption value="">None / Compliant (No Violation)</IonSelectOption>
        {VIOLATION_CATEGORIES.map((cat) => (
          <IonSelectOption key={cat.value} value={cat.value}>
            {cat.label} ({cat.lawReference})
          </IonSelectOption>
        ))}
      </IonSelect>
    </IonItem>
    <IonItem lines="inset" style={{ marginTop: '8px' }}>
      <IonLabel position="stacked">
        {violationCategory === 'OTHERS' ? 'NOTES * (REQUIRED FOR "OTHERS")' : 'NOTES (AUTO-UPPERCASE)'}
      </IonLabel>
      <IonTextarea
        rows={2}
        value={notes}
        placeholder={violationCategory === 'OTHERS' ? 'SPECIFY VIOLATION DETAILS *' : 'OBSERVATIONS'}
        onIonInput={(e) => onChangeNotes(toUpperClean(e.detail.value!))}
      />
    </IonItem>
    <div style={{ background: '#F8FAFC', padding: '10px', borderRadius: '8px', marginTop: '12px', fontSize: '13px' }}>
      <div>
        <strong>NH3:</strong> {ammonia !== null && ammonia !== undefined ? `${ammonia.toFixed(2)} PPM` : '—'} |{' '}
        <strong>Temp:</strong> {temperature !== null && temperature !== undefined ? `${temperature.toFixed(1)}°C` : '—'}
      </div>
      <div><strong>GPS:</strong> {lat.toFixed(4)}, {lng.toFixed(4)}</div>
    </div>
    <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
      <IonButton fill="outline" onClick={onBack}><IonIcon icon={arrowBackOutline} /></IonButton>
      <IonButton expand="block" style={{ flex: 1 }} color="success" onClick={onSave} disabled={saving}>
        {saving ? <IonSpinner name="crescent" /> : <><IonIcon icon={checkmarkCircleOutline} slot="start" /> Save Tag</>}
      </IonButton>
    </div>
  </div>
  );
};
export default TagFormReview;
