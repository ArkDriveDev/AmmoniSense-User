import React from 'react';
import { IonItem, IonLabel, IonInput, IonButton, IonIcon } from '@ionic/react';
import { locateOutline, arrowForwardOutline } from 'ionicons/icons';
import { Geolocation } from '@capacitor/geolocation';

interface Props {
  lat: number;
  lng: number;
  onChangeLat: (v: number) => void;
  onChangeLng: (v: number) => void;
  onNext: () => void;
}

export const TagLocationStep: React.FC<Props> = ({ lat, lng, onChangeLat, onChangeLng, onNext }) => {
  const refreshGPS = () => {
    Geolocation.getCurrentPosition({ enableHighAccuracy: true })
      .then((p) => { onChangeLat(p.coords.latitude); onChangeLng(p.coords.longitude); })
      .catch(() => {});
  };

  return (
    <div>
      <h4 style={{ margin: '0 0 12px 0' }}>Step 1: Tag Location</h4>
      <IonItem lines="inset">
        <IonLabel position="stacked">LATITUDE</IonLabel>
        <IonInput type="number" value={lat} onIonInput={(e) => onChangeLat(Number(e.detail.value))} />
      </IonItem>
      <IonItem lines="inset" style={{ marginTop: '8px' }}>
        <IonLabel position="stacked">LONGITUDE</IonLabel>
        <IonInput type="number" value={lng} onIonInput={(e) => onChangeLng(Number(e.detail.value))} />
      </IonItem>
      <IonButton expand="block" fill="outline" style={{ marginTop: '12px' }} onClick={refreshGPS}>
        <IonIcon icon={locateOutline} slot="start" /> Re-acquire GPS
      </IonButton>
      <IonButton expand="block" style={{ marginTop: '16px' }} onClick={onNext}>
        Next: Sensor Reading <IonIcon icon={arrowForwardOutline} slot="end" />
      </IonButton>
    </div>
  );
};
export default TagLocationStep;
