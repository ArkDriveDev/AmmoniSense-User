import React, { useState, useEffect } from 'react';
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonItem, IonLabel, IonInput, IonTextarea, IonSpinner, IonIcon,
  IonSelect, IonSelectOption
} from '@ionic/react';
import { closeOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { createSchedule, updateSchedule } from '../../services/scheduleService';
import { toUpperClean, InspectionSchedule } from '../../types/inspection';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  siteId: number | string;
  onCreated?: () => void;
  editSchedule?: InspectionSchedule | null;
}

export const CreateScheduleModal: React.FC<Props> = ({ isOpen, onClose, siteId, onCreated, editSchedule }) => {
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('09:00');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('PENDING');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (editSchedule) {
        setName(editSchedule.schedule_name || '');
        setDate(editSchedule.scheduled_date || new Date().toISOString().split('T')[0]);
        setTime(editSchedule.scheduled_time || '09:00');
        setNotes(editSchedule.notes || '');
        setStatus(editSchedule.status || 'PENDING');
      } else {
        setName('');
        setDate(new Date().toISOString().split('T')[0]);
        setTime('09:00');
        setNotes('');
        setStatus('PENDING');
      }
    }
  }, [isOpen, editSchedule]);

  const handleSave = async () => {
    if (!name.trim()) return alert('Please enter a schedule name');
    setSaving(true);
    try {
      if (editSchedule) {
        await updateSchedule(editSchedule.id, {
          schedule_name: toUpperClean(name),
          scheduled_date: date,
          scheduled_time: time,
          notes: toUpperClean(notes),
          status: status as any,
        });
      } else {
        await createSchedule({
          inspection_site_id: siteId,
          schedule_name: toUpperClean(name),
          scheduled_date: date,
          scheduled_time: time,
          notes: toUpperClean(notes),
          status: 'SCHEDULED',
        });
      }
      onCreated?.();
      onClose();
    } catch (err: any) {
      alert(err.message || 'Failed to save schedule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      <IonHeader>
        <IonToolbar style={{ '--background': 'linear-gradient(135deg, #0F3C5C 0%, #1D5D9B 100%)', '--color': '#ffffff' }}>
          <IonTitle>{editSchedule ? 'Update Schedule' : 'New Schedule Visit'}</IonTitle>
          <IonButtons slot="end"><IonButton onClick={onClose} style={{ color: '#ffffff' }}><IonIcon icon={closeOutline} /></IonButton></IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding" style={{ '--background': '#F8FAFC' }}>
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
        {editSchedule && (
          <IonItem lines="inset" style={{ marginTop: '10px' }}>
            <IonLabel position="stacked">STATUS</IonLabel>
            <IonSelect value={status} onIonChange={(e) => setStatus(e.detail.value)}>
              <IonSelectOption value="PENDING">PENDING</IonSelectOption>
              <IonSelectOption value="IN_PROGRESS">IN PROGRESS</IonSelectOption>
              <IonSelectOption value="COMPLETED">COMPLETED</IonSelectOption>
              <IonSelectOption value="CANCELLED">CANCELLED</IonSelectOption>
            </IonSelect>
          </IonItem>
        )}
        <IonItem lines="inset" style={{ marginTop: '10px' }}>
          <IonLabel position="stacked">NOTES</IonLabel>
          <IonTextarea rows={3} value={notes} placeholder="INSPECTION NOTES" onIonInput={(e) => setNotes(toUpperClean(e.detail.value!))} />
        </IonItem>
        <div style={{ marginTop: '20px' }}>
          <IonButton expand="block" onClick={handleSave} disabled={saving} style={{ '--background': 'linear-gradient(135deg, #0F3C5C 0%, #1D5D9B 100%)', fontWeight: 700 }}>
            {saving ? <IonSpinner name="crescent" /> : <><IonIcon icon={checkmarkCircleOutline} slot="start" /> {editSchedule ? 'Update Schedule Details' : 'Save Schedule'}</>}
          </IonButton>
        </div>
      </IonContent>
    </IonModal>
  );
};
export default CreateScheduleModal;
