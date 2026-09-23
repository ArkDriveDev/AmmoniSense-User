import React from 'react';
import { IonButton, IonIcon } from '@ionic/react';
import { cameraOutline, arrowBackOutline, arrowForwardOutline } from 'ionicons/icons';

interface Props {
  photoDataUrl: string;
  onCapture: () => void;
  onBack: () => void;
  onNext: () => void;
}

export const TagPhotoStep: React.FC<Props> = ({ photoDataUrl, onCapture, onBack, onNext }) => (
  <div>
    <h4 style={{ margin: '0 0 12px 0' }}>Step 3: Tag Photo</h4>
    {photoDataUrl ? (
      <div style={{ textAlign: 'center' }}>
        <img src={photoDataUrl} alt="Preview" style={{ maxHeight: '200px', borderRadius: '10px' }} />
        <IonButton expand="block" fill="outline" style={{ marginTop: '10px' }} onClick={onCapture}>
          <IonIcon icon={cameraOutline} slot="start" /> Retake Photo
        </IonButton>
      </div>
    ) : (
      <IonButton expand="block" style={{ height: '56px' }} onClick={onCapture}>
        <IonIcon icon={cameraOutline} slot="start" /> Take Tag Photo
      </IonButton>
    )}
    <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
      <IonButton fill="outline" onClick={onBack}><IonIcon icon={arrowBackOutline} /></IonButton>
      <IonButton expand="block" style={{ flex: 1 }} onClick={onNext}>
        Next: Details <IonIcon icon={arrowForwardOutline} slot="end" />
      </IonButton>
    </div>
  </div>
);
export default TagPhotoStep;
