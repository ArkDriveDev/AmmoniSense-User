import {
  IonSplitPane,
  IonMenu,
  IonContent,
  IonList,
  IonItem,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonPage,
  IonIcon,
  IonLabel,
  IonBadge,
  IonMenuButton,
  IonButtons,
  IonAvatar,
  IonText
} from '@ionic/react';

import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../services/supabase';
import offlineStorage from '../services/OfflineStorageService';
import SyncStatusBanner from '../components/common/SyncStatusBanner';
import {
  homeOutline,
  businessOutline,
  hardwareChipOutline,
  barChartOutline,
  logOutOutline,
  personCircleOutline,
  closeOutline,
  menuOutline,
  mapOutline
} from 'ionicons/icons';
import { useEffect, useState } from 'react';