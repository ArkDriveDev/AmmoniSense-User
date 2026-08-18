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
  SiteMarkerData,
  ReadingMarkerData,
  PhotoTagMarkerData,
  SITE_BRAND_COLOR,
  PHOTO_TAG_BRAND_COLOR,
  getAmmoniaColor,
  getAmmoniaSeverityLabel
} from '../../components/map/FullMapView';
import { Geolocation } from '@capacitor/geolocation';
import { useNavigate } from 'react-router-dom';
import PendingSyncBadge from '../../components/common/PendingSyncBadge';

// Default Center Coordinates: Manolo Fortich Municipality
const MANOLO_FORTICH_CENTER = { lat: 8.3683, lng: 124.8637, zoom: 13 };

const IS_IN_MANOLO_FORTICH = (lat?: number, lng?: number): boolean => {
  if (!lat || !lng) return false;
  return lat >= 8.2200 && lat <= 8.5000 && lng >= 124.7000 && lng <= 125.0200;
};

export default function UserMap() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(true);
  const [sites, setSites] = useState<SiteMarkerData[]>([]);
  const [readings, setReadings] = useState<ReadingMarkerData[]>([]);
  const [photoTags, setPhotoTags] = useState<PhotoTagMarkerData[]>([]);
  const [odorZones, setOdorZones] = useState<OdorZone[]>([]);
  const [communityPolygons, setCommunityPolygons] = useState<CommunityPolygon[]>([]);

  // Search input
  const [searchText, setSearchText] = useState<string>('');

  // Layer Toggles
  const [showSitesLayer, setShowSitesLayer] = useState<boolean>(true);