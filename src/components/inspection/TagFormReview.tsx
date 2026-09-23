import React from 'react';
import { IonItem, IonLabel, IonInput, IonTextarea, IonButton, IonIcon, IonSpinner } from '@ionic/react';
import { arrowBackOutline, checkmarkCircleOutline } from 'ionicons/icons';
import { toUpperClean } from '../../types/inspection';

interface Props {
  tagName: string;
  notes: string;
  ammonia: number;
  temperature: number;
  lat: number;
  lng: number;
  saving: boolean;
  onChangeTagName: (v: string) => void;
  onChangeNotes: (v: string) => void;
  onBack: () => void;
  onSave: () => void;
}

export const TagFormReview: React.FC<Props> = ({
  tagName, notes, ammonia, temperature, lat, lng, saving,
  onChangeTagName, onChangeNotes, onBack, onSave
}) => (
  <div>
    <h4 style={{ margin: '0 0 12px 0' }}>Step 4: Tag Name & Review</h4>
    <IonItem lines="inset">
      <IonLabel position="stacked">TAG NAME * (AUTO-UPPERCASE)</IonLabel>
      <IonInput value={tagName} placeholder="E.G. PEN 1 CORNER A" onIonInput={(e) => onChangeTagName(toUpperClean(e.detail.value!))} />
    </IonItem>
    <IonItem lines="inset" style={{ marginTop: '8px' }}>
      <IonLabel position="stacked">NOTES (AUTO-UPPERCASE)</IonLabel>
      <IonTextarea rows={2} value={notes} placeholder="OBSERVATIONS" onIonInput={(e) => onChangeNotes(toUpperClean(e.detail.value!))} />
    </IonItem>
    <div style={{ background: '#F8FAFC', padding: '10px', borderRadius: '8px', marginTop: '12px', fontSize: '13px' }}>
      <div><strong>NH3:</strong> {ammonia.toFixed(2)} PPM | <strong>Temp:</strong> {temperature.toFixed(1)}°C</div>
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
export default TagFormReview;
