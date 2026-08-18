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
  [8.2200, 124.7000], // South-West
  [8.5000, 125.0200]  // North-East
];

// Manolo Fortich Municipal Boundary Polygon
const MANOLO_FORTICH_BOUNDARY: [number, number][] = [
  [8.4650, 124.7800],
  [8.4800, 124.8500],
  [8.4600, 124.9200],
  [8.4100, 124.9600],
  [8.3500, 124.9700],
  [8.2800, 124.9300],
  [8.2600, 124.8500],
  [8.2900, 124.7500],
  [8.3600, 124.7300],
  [8.4200, 124.7500],
];

// Outer World ring for inverted masking outside Manolo Fortich
const WORLD_MASK_RING: [number, number][] = [
  [90, -180],
  [90, 180],
  [-90, -180],
  [-90, -180],
];

// Brand Color for all Site Pins
export const SITE_BRAND_COLOR = '#1D5D9B';
export const PHOTO_TAG_BRAND_COLOR = '#8b5cf6'; // Purple for photo tags

export const getAmmoniaColor = (ammonia: number): string => {
  if (ammonia > 20) return '#ef4444'; // Critical Red (>20 PPM)
  if (ammonia > 10) return '#f97316'; // High Orange (10-20 PPM)
  if (ammonia > 5) return '#eab308'; // Warning Yellow (5-10 PPM)
  return '#22c55e'; // Normal Green (0-5 PPM)
};

export const getAmmoniaSeverityLabel = (ammonia: number): string => {
  if (ammonia > 20) return 'Critical';
  if (ammonia > 10) return 'High';
  if (ammonia > 5) return 'Warning';
  return 'Normal';
};

export const FullMapView: React.FC<FullMapViewProps> = ({
  sites = [],
  readings = [],
  photoTags = [],
  odorZones = [],
  communityPolygons = [],
  showSitesLayer = true,
  showReadingsLayer = true,
  showPhotoTagsLayer = true,
  showBoundaryLayer = true,
  showOdorZonesLayer = true,
  onSelectSite,
  onSelectReading,
  onSelectPhotoTag,
  centerLat = 8.3683,
  centerLng = 124.8637,
  zoom = 13,
  userLocation = null,
  height = '100%',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  const boundaryLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const sitesLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const readingsLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const photoTagsLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const userLocLayerGroupRef = useRef<L.LayerGroup | null>(null);

  // Initialize Map Instance with Strict Bounds
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom: zoom,
      minZoom: 11,
      maxZoom: 18,
      maxBounds: MANOLO_FORTICH_BOUNDS,
      maxBoundsViscosity: 1.0, // Strictly prevent panning outside bounds
      zoomControl: false,
    });

    // Tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | MENRO Manolo Fortich',
      maxZoom: 20,
    }).addTo(map);

    boundaryLayerGroupRef.current = L.layerGroup().addTo(map);
    sitesLayerGroupRef.current = L.layerGroup().addTo(map);
    readingsLayerGroupRef.current = L.layerGroup().addTo(map);
    photoTagsLayerGroupRef.current = L.layerGroup().addTo(map);
    userLocLayerGroupRef.current = L.layerGroup().addTo(map);
