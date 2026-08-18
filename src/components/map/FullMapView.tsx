import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import OdorZonePolygonLayer from './OdorZonePolygonLayer';
import { OdorZone, CommunityPolygon } from '../../types/site';

export interface SiteMarkerData {
  id: string | number;
  site_code?: string;
  site_name: string;
  site_type?: string;
  address?: string;
  latitude: number;
  longitude: number;
  owner_name?: string;
  photo_url?: string;
  status?: string;
  isOffline?: boolean;
  is_pending_sync?: boolean;
}

export interface ReadingMarkerData {
  id: string | number;
  ammonia: number;
  temperature?: number;
  humidity?: number;
  battery?: number;
  latitude: number;
  longitude: number;
  device_uid?: string;
  created_at: string;
  photo_url?: string;
  is_pending_sync?: boolean;
}

export interface PhotoTagMarkerData {
  id: string | number;
  latitude: number;
  longitude: number;
  photo_url: string;
  site_id?: number | null;
  site_name?: string;
  is_used?: boolean;
  uploaded_at?: string;
  is_pending_sync?: boolean;
}

interface FullMapViewProps {
  sites?: SiteMarkerData[];
  readings?: ReadingMarkerData[];
  photoTags?: PhotoTagMarkerData[];
  odorZones?: OdorZone[];
  communityPolygons?: CommunityPolygon[];
  showSitesLayer?: boolean;
  showReadingsLayer?: boolean;
  showPhotoTagsLayer?: boolean;
  showBoundaryLayer?: boolean;
  showOdorZonesLayer?: boolean;
  onSelectSite?: (site: SiteMarkerData) => void;
  onSelectReading?: (reading: ReadingMarkerData) => void;
  onSelectPhotoTag?: (tag: PhotoTagMarkerData) => void;
  centerLat?: number;
  centerLng?: number;
  zoom?: number;
  userLocation?: { lat: number; lng: number } | null;
  height?: string;
}

// Manolo Fortich Bounding Box Restriction
export const MANOLO_FORTICH_BOUNDS: L.LatLngBoundsExpression = [