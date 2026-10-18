import React, { useState, useEffect } from 'react';
import {
  IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton,
  IonContent, IonItem, IonLabel, IonInput, IonTextarea, IonSpinner, IonIcon,
  IonSelect, IonSelectOption
} from '@ionic/react';
import { closeOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { createSchedule, updateSchedule } from '../../services/scheduleService';
import { toUpperClean, InspectionSchedule } from '../../types/inspection';
import { showToast } from '../../utils/toast';
import { formatTime12h, split24hTo12h, to24hString } from '../../utils/timeUtils';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  siteId: number | string;
  onCreated?: () => void;
  editSchedule?: InspectionSchedule | null;
}

const getTodayLocalDate = (): string => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

const selectStyle: React.CSSProperties = {
  padding: '6px 10px',
  borderRadius: '8px',
  border: '1px solid #CBD5E1',
  background: '#FFFFFF',
  fontSize: '15px',
  fontWeight: 600,
  color: '#0F172A',
};

export const CreateScheduleModal: React.FC<Props> = ({ isOpen, onClose, siteId, onCreated, editSchedule }) => {
  const todayStr = getTodayLocalDate();
  const [name, setName] = useState('');
  const [date, setDate] = useState(todayStr);
  const [time, setTime] = useState('09:00');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('PENDING');
  const [saving, setSaving] = useState(false);

  const { hour12, minute, ampm } = split24hTo12h(time);
  const minuteOptions = Array.from(new Set([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, minute])).sort((a, b) => a - b);

  const handleTimePartChange = (newHour: number, newMin: number, newAmpm: 'AM' | 'PM') => {
    setTime(to24hString(newHour, newMin, newAmpm));
  };

  useEffect(() => {
    if (isOpen) {
      const currentToday = getTodayLocalDate();
      if (editSchedule) {
        setName(editSchedule.schedule_name || '');
        const schedDate = editSchedule.scheduled_date || currentToday;
        setDate(schedDate < currentToday ? currentToday : schedDate);
        setTime(editSchedule.scheduled_time || '09:00');
        setNotes(editSchedule.notes || '');
        setStatus(editSchedule.status || 'PENDING');
      } else {
        setName('');
        setDate(currentToday);
        setTime('09:00');
        setNotes('');
        setStatus('PENDING');
      }
    }
  }, [isOpen, editSchedule]);

  const handleSave = async () => {
    if (!name.trim()) {
      showToast({ message: 'Please enter a schedule name', color: 'danger' });
      return;
    }
    const currentToday = getTodayLocalDate();
    if (date < currentToday) {
      showToast({ message: 'Scheduled date cannot be in the past', color: 'danger' });
      return;
    }
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
        showToast({ message: 'Inspection schedule updated successfully!', color: 'success' });
      } else {
        const created = await createSchedule({
          inspection_site_id: siteId,
          schedule_name: toUpperClean(name),
          scheduled_date: date,
          scheduled_time: time,
          notes: toUpperClean(notes),
          status: 'SCHEDULED',
        });
        showToast({
          message: created.isOffline
            ? 'Schedule saved locally (offline - will sync when online)!'
            : 'Inspection schedule created successfully!',
          color: 'success',
        });
      }
      onCreated?.();
      onClose();
    } catch (err: any) {
      showToast({ message: err.message || 'Failed to save schedule', color: 'danger' });
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
          <input
            type="date"
            value={date}
            min={todayStr}
            onChange={(e) => {
              const val = e.target.value;
              const currentToday = getTodayLocalDate();
              setDate(val && val < currentToday ? currentToday : val);
            }}
            style={{ width: '100%', padding: '8px 0', border: 'none', background: 'transparent' }}
          />
        </IonItem>
        <IonItem lines="inset" style={{ marginTop: '10px' }}>
          <IonLabel position="stacked">SCHEDULED TIME (12-HOUR FORMAT) *</IonLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0', width: '100%', flexWrap: 'wrap' }}>
            <select value={hour12} onChange={(e) => handleTimePartChange(Number(e.target.value), minute, ampm)} style={selectStyle}>
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((h) => (
                <option key={h} value={h}>{String(h).padStart(2, '0')}</option>
              ))}
            </select>
            <span style={{ fontWeight: 700, fontSize: '16px', color: '#64748B' }}>:</span>
            <select value={minute} onChange={(e) => handleTimePartChange(hour12, Number(e.target.value), ampm)} style={selectStyle}>
              {minuteOptions.map((m) => (
                <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
              ))}
            </select>
            <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid #CBD5E1' }}>
              {(['AM', 'PM'] as const).map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => handleTimePartChange(hour12, minute, period)}
                  style={{
                    padding: '6px 12px',
                    background: ampm === period ? '#0F3C5C' : '#FFFFFF',
                    color: ampm === period ? '#FFFFFF' : '#475569',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  {period}
                </button>
              ))}
            </div>
            <div style={{ marginLeft: 'auto', background: '#E2E8F0', padding: '6px 10px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
              {formatTime12h(time)}
            </div>
          </div>
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
