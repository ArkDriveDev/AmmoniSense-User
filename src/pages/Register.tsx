import React, { useState } from 'react';
import {
  IonButton,
  IonContent,
  IonInput,
  IonInputPasswordToggle,
  IonPage,
  IonTitle,
  IonModal,
  IonText,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonToast,
  IonSpinner,
  IonGrid,
  IonRow,
  IonCol
} from '@ionic/react';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';

const Register: React.FC = () => {
  const navigate = useNavigate();


  return (
    <IonPage>
      <IonContent className="ion-padding">
        <IonGrid style={{ maxWidth: '500px', margin: '0 auto', marginTop: '40px' }}>
          <IonRow>
            <IonCol>
              <IonCard>
                <IonCardContent>
                  <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <IonTitle style={{ fontSize: '24px', fontWeight: 'bold' }}>
                      Create Account
                    </IonTitle>
                    <IonText color="medium">
                      <p>Register as Environmental Inspector</p>
                    </IonText>
                  </div>
                </IonCardContent>
              </IonCard>
            </IonCol>
          </IonRow>
        </IonGrid>
      </IonContent>
    </IonPage>
  );
};

export default Register;