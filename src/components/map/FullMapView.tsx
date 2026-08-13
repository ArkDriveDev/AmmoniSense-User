import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface SiteMarkerData {
  id: string | number;
  site_code?: string;
  site_name: string;
  site_type?: string;
  address?: string;
  latitude: number;
  longitude: number;
  owner_name?: string;
  grid_cell_id?: string;
  photo_url?: string;
  status?: string;
}

export interface ReadingMarkerData {
  id: string | number;
  ammonia: number;
  temperature?: number;
  humidity?: number;
  battery?: number;
  latitude: number;
  longitude: number;
  grid_cell_id?: string;
  device_uid?: string;
  created_at: string;
  photo_url?: string;
  is_pending_sync?: boolean;
}

interface FullMapViewProps {
  sites?: SiteMarkerData[];
  readings?: ReadingMarkerData[];
  showSitesLayer?: boolean;
  showReadingsLayer?: boolean;
  showBoundaryLayer?: boolean;
  onSelectSite?: (site: SiteMarkerData) => void;
  onSelectReading?: (reading: ReadingMarkerData) => void;
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
  [-90, 180],
  [-90, -180],
];

export const getSiteTypeColor = (type?: string): string => {
  const t = (type || '').toLowerCase();
  if (t.includes('piggery') || t.includes('pig')) return '#10b981'; // Green
  if (t.includes('ambient') || t.includes('agricultural') || t.includes('farm')) return '#3b82f6'; // Blue
  if (t.includes('industrial') || t.includes('factory')) return '#f97316'; // Orange
  return '#3b82f6'; // Default Blue
};

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
  showSitesLayer = true,
  showReadingsLayer = true,
  showBoundaryLayer = true,
  onSelectSite,
  onSelectReading,
  centerLat = 8.3683,
  centerLng = 124.8637,
  zoom = 13,
  userLocation = null,
  height = '100%',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  const boundaryLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const sitesLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const readingsLayerGroupRef = useRef<L.LayerGroup | null>(null);
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
    userLocLayerGroupRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update Center
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setView([centerLat, centerLng], zoom);
    }
  }, [centerLat, centerLng, zoom]);

  // Render User GPS Marker if within bounds
  useEffect(() => {
    if (!mapRef.current || !userLocLayerGroupRef.current) return;
    const userGroup = userLocLayerGroupRef.current;
    userGroup.clearLayers();

    if (userLocation) {
      const userMarker = L.circleMarker([userLocation.lat, userLocation.lng], {
        radius: 9,
        fillColor: '#3b82f6',
        color: '#ffffff',
        weight: 3,
        opacity: 1,
        fillOpacity: 0.9,
      });

      const pulseCircle = L.circle([userLocation.lat, userLocation.lng], {
        radius: 120,
        fillColor: '#3b82f6',
        fillOpacity: 0.15,
        stroke: false,
      });

      userMarker.bindPopup('<div style="font-weight: bold; color: #1e3a8a;">📍 Your Location (Manolo Fortich)</div>');

      userGroup.addLayer(pulseCircle);
      userGroup.addLayer(userMarker);
    }
  }, [userLocation]);

  // Render Municipal Boundary & Outer Mask Layer
  useEffect(() => {
    if (!mapRef.current || !boundaryLayerGroupRef.current) return;
    const boundaryGroup = boundaryLayerGroupRef.current;
    boundaryGroup.clearLayers();

    if (showBoundaryLayer) {
      // 1. Inverted Mask Polygon to obscure everything OUTSIDE Manolo Fortich
      const maskPolygon = L.polygon([WORLD_MASK_RING, MANOLO_FORTICH_BOUNDARY], {
        color: '#0f3c5c',
        weight: 2,
        fillColor: '#0f172a',
        fillOpacity: 0.65, // Mask out outside regions so ONLY Manolo Fortich is highlighted
        interactive: false,
      });

      // 2. Bright Boundary Line for Manolo Fortich
      const polygon = L.polygon(MANOLO_FORTICH_BOUNDARY, {
        color: '#10b981',
        weight: 3,
        dashArray: '8, 6',
        fillColor: '#2dd36f',
        fillOpacity: 0.05,
      });

      const labelIcon = L.divIcon({
        className: 'boundary-label-marker',
        html: `<div style="
          background: rgba(15, 60, 92, 0.92);
          color: white;
          padding: 4px 12px;
          border-radius: 14px;
          font-weight: bold;
          font-size: 11px;
          letter-spacing: 0.5px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.2);
          backdrop-filter: blur(4px);
          white-space: nowrap;
        ">🏛️ Manolo Fortich Municipality</div>`,
        iconSize: [190, 26],
        iconAnchor: [95, 13],
      });

      const labelMarker = L.marker([8.42, 124.86], { icon: labelIcon, interactive: false });

      boundaryGroup.addLayer(maskPolygon);
      boundaryGroup.addLayer(polygon);
      boundaryGroup.addLayer(labelMarker);
    }
  }, [showBoundaryLayer]);

  // Render Site Markers (Layer 1)
  useEffect(() => {
    if (!mapRef.current || !sitesLayerGroupRef.current) return;
    const sitesGroup = sitesLayerGroupRef.current;
    sitesGroup.clearLayers();

    if (!showSitesLayer) return;

    sites.forEach((site) => {
      if (!site.latitude || !site.longitude) return;

      const color = getSiteTypeColor(site.site_type);

      const customIcon = L.divIcon({
        className: 'site-pin-marker',
        html: `
          <div style="
            position: relative;
            width: 32px;
            height: 32px;
            background: ${color};
            border: 2.5px solid #ffffff;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          ">
            <div style="
              transform: rotate(45deg);
              color: #ffffff;
              font-size: 14px;
              font-weight: bold;
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              🏢
            </div>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
      });

      const marker = L.marker([site.latitude, site.longitude], { icon: customIcon });

      marker.on('click', () => {
        if (onSelectSite) onSelectSite(site);
      });

      sitesGroup.addLayer(marker);
    });
  }, [sites, showSitesLayer, onSelectSite]);

  // Render Sensor Reading Dots (Layer 2)
  useEffect(() => {
    if (!mapRef.current || !readingsLayerGroupRef.current) return;
    const readingsGroup = readingsLayerGroupRef.current;
    readingsGroup.clearLayers();

    if (!showReadingsLayer) return;

    readings.forEach((reading) => {
      if (!reading.latitude || !reading.longitude) return;

      const color = getAmmoniaColor(reading.ammonia);

      const circleMarker = L.circleMarker([reading.latitude, reading.longitude], {
        radius: 10,
        fillColor: color,
        color: '#ffffff',
        weight: 2.5,
        opacity: 1,
        fillOpacity: 0.85,
      });

      if (reading.ammonia > 20) {
        const pulse = L.circle([reading.latitude, reading.longitude], {
          radius: 100,
          fillColor: '#ef4444',
          fillOpacity: 0.2,
          stroke: false,
        });
        readingsGroup.addLayer(pulse);
      }

      circleMarker.on('click', () => {
        if (onSelectReading) onSelectReading(reading);
      });

      readingsGroup.addLayer(circleMarker);
    });
  }, [readings, showReadingsLayer, onSelectReading]);

  return (
    <div style={{ position: 'relative', width: '100%', height, overflow: 'hidden' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />
    </div>
  );
};

export default FullMapView;
