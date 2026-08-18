import React, { useEffect, useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonIcon,
  IonGrid,
  IonToast,
  IonRefresher,
  IonRefresherContent
} from '@ionic/react';
import {
  bluetoothOutline,
  searchOutline,
  cloudUploadOutline
} from 'ionicons/icons';
import { useNavigate } from 'react-router-dom';