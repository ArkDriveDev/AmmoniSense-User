import React from 'react';
import { IonItem, IonLabel, IonInput, IonButton, IonIcon, IonSpinner, IonBadge } from '@ionic/react';
import { arrowBackOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { ViolationCategory, toUpperClean } from '../../types/inspection';

interface Props {
  tagName: string;
  notes: string;
  violationCategory: ViolationCategory | null;
  ammonia: number | null;
  temperature: number | null;
  lat: number;
  lng: number;
  saving: boolean;
  isRecoveryMode?: boolean;
  errorMessage?: string | null;
  onChangeTagName: (v: string) => void;
  onBack: () => void;
  onSave: () => void;
}

export const TagFormReview: React.FC<Props> = ({
  tagName, notes, violationCategory, ammonia, temperature, lat, lng, saving,
  isRecoveryMode, errorMessage,
  onChangeTagName, onBack, onSave
}) => (
  <div>
    <h4 style={{ margin: '0 0 12px 0' }}>Step 4: Tag Name & Review</h4>
    <IonItem lines="inset">
      <IonLabel position="stacked">TAG NAME * (AUTO-UPPERCASE)</IonLabel>
      <IonInput value={tagName} placeholder="E.G. PEN 1 CORNER A" onIonInput={(e) => onChangeTagName(toUpperClean(e.detail.value!))} />
    </IonItem>
    <IonItem lines="inset" style={{ marginTop: '8px' }}>
      <IonLabel position="stacked">Findings</IonLabel>
      <div style={{ padding: '8px 0 6px 0' }}>
        {violationCategory === 'FOUL_ODOR' || (Number(ammonia) || 0) >= 25 ? (
          <IonBadge color="danger" style={{ fontSize: '12px', fontWeight: 700, padding: '6px 10px' }}>
            FOUL ODOR VIOLATION
          </IonBadge>
        ) : (
          <IonBadge color="medium" style={{ fontSize: '12px', fontWeight: 700, padding: '6px 10px' }}>
            No Violation
          </IonBadge>
        )}
      </div>
    </IonItem>
    <IonItem lines="inset" style={{ marginTop: '8px' }}>
      <IonLabel position="stacked">Notes</IonLabel>
      <p style={{ margin: '8px 0 6px 0', fontSize: '14px', color: '#1E293B', lineHeight: 1.4 }}>
        {notes || 'No foul odor detected.'}
      </p>
    </IonItem>
    <div style={{ background: '#F8FAFC', padding: '10px', borderRadius: '8px', marginTop: '12px', fontSize: '13px' }}>
      <div>
        <strong>Avg NH₃:</strong> {ammonia !== null && ammonia !== undefined ? `${ammonia.toFixed(2)} ppm` : '—'} |{' '}
        <strong>Temp:</strong> {temperature !== null && temperature !== undefined ? `${temperature.toFixed(1)}°C` : '—'}
      </div>
      <div><strong>GPS:</strong> {lat.toFixed(4)}, {lng.toFixed(4)}</div>
    </div>
    {errorMessage && (
      <div style={{ marginTop: '10px', padding: '10px', background: '#FEE2E2', border: '1px solid #EF4444', borderRadius: '6px', color: '#991B1B', fontSize: '12px', fontWeight: 600 }}>
        {errorMessage}
      </div>
    )}
    {isRecoveryMode && (
      <div style={{ marginTop: '8px', fontSize: '12px', color: '#B45309', fontWeight: 600, textAlign: 'right' }}>
        Saves to queue only (recovery)
      </div>
    )}
    <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
      <IonButton fill="outline" onClick={onBack}><IonIcon icon={arrowBackOutline} /></IonButton>
      <IonButton expand="block" style={{ flex: 1 }} color="success" onClick={onSave} disabled={saving}>
        {saving ? <IonSpinner name="crescent" /> : <><IonIcon icon={checkmarkCircleOutline} slot="start" /> Save Tag</>}
      </IonButton>
    </div>
  </div>
);
export default TagFormReview;
