import React, { useState } from 'react';
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonItem, IonLabel, IonInput, IonTextarea, IonSpinner, IonIcon
} from '@ionic/react';
import { closeOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { createSchedule } from '../../services/scheduleService';
import { toUpperClean } from '../../types/inspection';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  siteId: number | string;
  onCreated?: () => void;
}

export const CreateScheduleModal: React.FC<Props> = ({ isOpen, onClose, siteId, onCreated }) => {
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('09:00');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) return alert('Please enter a schedule name');
    setSaving(true);
    try {
      await createSchedule({
        inspection_site_id: siteId,
        schedule_name: toUpperClean(name),
        scheduled_date: date,
        scheduled_time: time,
        notes: toUpperClean(notes),
        status: 'PENDING',
      });
      setName('');
      setNotes('');
      onCreated?.();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to create schedule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>New Schedule Visit</IonTitle>
          <IonButtons slot="end"><IonButton onClick={onClose}><IonIcon icon={closeOutline} /></IonButton></IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonItem lines="inset">
          <IonLabel position="stacked">SCHEDULE NAME *</IonLabel>
          <IonInput value={name} placeholder="ROUTINE MORNING VISIT" onIonInput={(e) => setName(toUpperClean(e.detail.value!))} />
        </IonItem>
        <IonItem lines="inset" style={{ marginTop: '10px' }}>
          <IonLabel position="stacked">SCHEDULED DATE *</IonLabel>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: '100%', padding: '8px 0', border: 'none', background: 'transparent' }} />
        </IonItem>
        <IonItem lines="inset" style={{ marginTop: '10px' }}>
          <IonLabel position="stacked">SCHEDULED TIME *</IonLabel>
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={{ width: '100%', padding: '8px 0', border: 'none', background: 'transparent' }} />
        </IonItem>
        <IonItem lines="inset" style={{ marginTop: '10px' }}>
          <IonLabel position="stacked">NOTES</IonLabel>
          <IonTextarea rows={3} value={notes} placeholder="INSPECTION NOTES" onIonInput={(e) => setNotes(toUpperClean(e.detail.value!))} />
        </IonItem>
        <div style={{ marginTop: '20px' }}>
          <IonButton expand="block" onClick={handleSave} disabled={saving}>
            {saving ? <IonSpinner name="crescent" /> : <><IonIcon icon={checkmarkCircleOutline} slot="start" /> Save Schedule</>}
          </IonButton>
        </div>
      </IonContent>
    </IonModal>
  );
};
export default CreateScheduleModal;
