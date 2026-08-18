import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  IonCard,
  IonCardContent,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonBadge,
  IonChip
} from '@ionic/react';
import {
  shapesOutline,
  refreshOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  trashOutline,
  saveOutline,
  addOutline
} from 'ionicons/icons';
import { MANOLO_FORTICH_BOUNDS } from './FullMapView';
import { OdorZone, CommunityPolygon } from '../../types/site';

interface PolygonDrawerProps {
  centerLat?: number;
  centerLng?: number;
  zoom?: number;
  height?: string;
  onSaveOdorZone?: (zone: OdorZone) => void;
  onSaveCommunity?: (community: CommunityPolygon) => void;