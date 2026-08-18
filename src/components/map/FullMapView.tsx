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
