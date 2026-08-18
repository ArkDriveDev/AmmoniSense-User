import React, { useEffect, useState } from 'react';
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButton,
  IonButtons,
  IonIcon,
  IonSpinner,
  IonSearchbar,
  IonBadge,
  IonCard,
  IonToast,
  IonModal,
  IonPopover
} from '@ionic/react';
import {
  refreshOutline,
  locateOutline,
  layersOutline,
  informationCircleOutline,
  closeOutline,
  hardwareChipOutline,
  eyeOutline,
  locationOutline,
  trashOutline
} from 'ionicons/icons';

import { supabase } from '../../services/supabase';
import offlineStorage from '../../services/OfflineStorageService';
import { fetchOdorZones, fetchCommunityPolygons, deleteSite } from '../../services/siteService';
import { OdorZone, CommunityPolygon } from '../../types/site';
import FullMapView, {