// RecoveryScreen.tsx — Temporary in-app recovery tool.
// Lets you create tags for orphaned sensor_data sessions and link them to the offline queue.
// Remove by setting RECOVERY_MODE = false in src/constants/recoveryConfig.ts

import React from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSpinner,
} from '@ionic/react';

const RecoveryScreen: React.FC = () => {
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': '#1D5D9B', '--color': '#fff' }}>
          <IonTitle>Recovery Mode</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        <IonSpinner name="crescent" />
      </IonContent>
    </IonPage>
  );
};

export default RecoveryScreen;

