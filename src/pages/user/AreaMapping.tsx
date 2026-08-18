import React, { useEffect, useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonBadge,
  IonButton,
  IonIcon,
  IonSpinner,
  IonToast,
  IonRefresher,
  IonRefresherContent
} from '@ionic/react';
import {
  shapesOutline,
  refreshOutline,
  checkmarkCircleOutline,
  warningOutline,
  trashOutline,
  layersOutline
} from 'ionicons/icons';
import PolygonDrawer from '../../components/map/PolygonDrawer';
import { OdorZone, CommunityPolygon } from '../../types/site';
import {
  fetchOdorZones,
  saveOdorZone,
  fetchCommunityPolygons,
  saveCommunityPolygon