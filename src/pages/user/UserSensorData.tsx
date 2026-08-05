import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonIcon
} from '@ionic/react';
import { useState } from 'react';
import { addCircleOutline, mapOutline } from 'ionicons/icons';
import SensorSubmissionForm from '../../components/inspection/SensorSubmissionForm';
import AdminSensorDataViewer from '../../components/admin/AdminSensorDataViewer';

export default function UserSensorData() {
  const [segment, setSegment] = useState<'submit' | 'view'>('submit');

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>MENRO Spatial Sensor Readings</IonTitle>
        </IonToolbar>
        <IonToolbar>
          <IonSegment value={segment} onIonChange={e => setSegment(e.detail.value as 'submit' | 'view')}>
            <IonSegmentButton value="submit">
              <IonIcon icon={addCircleOutline} />
              <IonLabel>Grid Inspection & Camera</IonLabel>
            </IonSegmentButton>
            <IonSegmentButton value="view">
              <IonIcon icon={mapOutline} />
              <IonLabel>Map & Sensor Logs</IonLabel>
            </IonSegmentButton>
          </IonSegment>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {segment === 'submit' ? (
          <SensorSubmissionForm onSuccess={() => setSegment('view')} />
        ) : (
          <AdminSensorDataViewer />
        )}
      </IonContent>
    </IonPage>
  );
}