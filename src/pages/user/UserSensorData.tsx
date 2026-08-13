import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle
} from '@ionic/react';
import { useNavigate } from 'react-router-dom';
import SensorSubmissionForm from '../../components/inspection/SensorSubmissionForm';

export default function UserSensorData() {
  const navigate = useNavigate();

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar color="primary">
          <IonTitle>MENRO Grid Inspection & Sensor Form</IonTitle>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <SensorSubmissionForm onSuccess={() => navigate('/map')} />
      </IonContent>
    </IonPage>
  );
}