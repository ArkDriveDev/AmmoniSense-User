import React, { useEffect, useState } from 'react';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonGrid,
  IonRow,
  IonCol,
  IonBadge,
  IonButton,
  IonIcon,
  IonModal,
  IonSpinner
} from '@ionic/react';
import { eyeOutline, locationOutline, calendarOutline, hardwareChipOutline, imageOutline, mapOutline } from 'ionicons/icons';
import { supabase } from '../../services/supabase';
import FullMapView, { ReadingMarkerData } from '../map/FullMapView';
import offlineStorage from '../../services/OfflineStorageService';
import PendingSyncBadge from '../common/PendingSyncBadge';

export interface SensorRecord {
  id: number | string;
  device_uid: string;
  ammonia: number;
  temperature?: number;
  humidity?: number;
  battery?: number;
  status: string;
  latitude?: number;
  longitude?: number;