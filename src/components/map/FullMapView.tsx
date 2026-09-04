import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import OdorZoneLayer from './OdorZoneLayer';
import { OdorZone } from '../../types/site';

export interface SiteMarkerData {
  id: string | number;
  site_code?: string;
  site_name: string;
  site_type?: string;
  address?: string;
  latitude: number;
  longitude: number;
  area_size_hectares?: number;
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
  grid_cell_id?: string;
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
  grid_cell_id?: string;
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
  showSitesLayer?: boolean;
  showSitePolygonsLayer?: boolean;
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

// Strict Manolo Fortich Bounding Box Restriction
export const MANOLO_FORTICH_BOUNDS: L.LatLngBoundsExpression = [
  [8.2200, 124.7000], // South-West
  [8.5000, 125.0200]  // North-East
];

// Manolo Fortich Municipal Boundary Polygon
export const MANOLO_FORTICH_BOUNDARY: [number, number][] = [
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

// Brand Colors
export const SITE_BRAND_COLOR = '#1D5D9B';
export const PHOTO_TAG_BRAND_COLOR = '#8b5cf6';

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
  showSitesLayer = true,
  showSitePolygonsLayer = true,
  showReadingsLayer = true,
  showPhotoTagsLayer = true,
  showBoundaryLayer = true,
  showOdorZonesLayer = true,
  onSelectSite,
  onSelectReading,
  onSelectPhotoTag,
  centerLat = 8.3683,
  centerLng = 124.8637,
  zoom = 12.5,
  userLocation = null,
  height = '100%',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  const boundaryLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const sitePolygonsLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const sitesLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const readingsLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const photoTagsLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const userLocLayerGroupRef = useRef<L.LayerGroup | null>(null);

  // Initialize Map Instance with Strict Manolo Fortich Restriction
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom: zoom,
      minZoom: 12, // Strict zoom-out lock to Manolo Fortich only
      maxZoom: 18,
      zoomSnap: 0.5,
      zoomDelta: 0.5,
      maxBounds: MANOLO_FORTICH_BOUNDS,
      maxBoundsViscosity: 1.0, // 100% solid boundary barrier - prevents panning outside
      bounceAtZoomLimits: false,
      zoomControl: false,
    });

    // Tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | MENRO Manolo Fortich',
      maxZoom: 20,
    }).addTo(map);

    boundaryLayerGroupRef.current = L.layerGroup().addTo(map);
    sitePolygonsLayerGroupRef.current = L.layerGroup().addTo(map);
    sitesLayerGroupRef.current = L.layerGroup().addTo(map);
    readingsLayerGroupRef.current = L.layerGroup().addTo(map);
    photoTagsLayerGroupRef.current = L.layerGroup().addTo(map);
    userLocLayerGroupRef.current = L.layerGroup().addTo(map);

    mapRef.current = map;
    setMapInstance(map);

    // Initial resize trigger
    setTimeout(() => {
      if (map) map.invalidateSize();
    }, 200);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMapInstance(null);
    };
  }, []);

  // ResizeObserver for Mobile Responsiveness
  useEffect(() => {
    if (!mapInstance || !mapContainerRef.current) return;

    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    });

    resizeObserver.observe(mapContainerRef.current);

    const handleWindowResize = () => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    };

    window.addEventListener('resize', handleWindowResize);
    window.addEventListener('orientationchange', handleWindowResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
      window.removeEventListener('orientationchange', handleWindowResize);
    };
  }, [mapInstance]);

  // Update Center if requested
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setView([centerLat, centerLng], zoom);
    }
  }, [centerLat, centerLng, zoom]);

  // Render User GPS Marker
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

  // Render Municipal Boundary & Inverted Mask (Only Manolo Fortich is shown)
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
        fillOpacity: 0.85, // Mask outside regions so ONLY Manolo Fortich is shown
        interactive: false,
      });

      // 2. Boundary Line for Manolo Fortich
      const polygon = L.polygon(MANOLO_FORTICH_BOUNDARY, {
        color: '#10b981',
        weight: 3.5,
        dashArray: '8, 6',
        fillColor: '#2dd36f',
        fillOpacity: 0.04,
      });

      const labelIcon = L.divIcon({
        className: 'boundary-label-marker',
        html: `<div style="
          background: rgba(15, 60, 92, 0.95);
          color: white;
          padding: 4px 12px;
          border-radius: 14px;
          font-weight: bold;
          font-size: 11px;
          letter-spacing: 0.5px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.25);
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

  // Render Site Area Coverage Polygons
  useEffect(() => {
    if (!mapRef.current || !sitePolygonsLayerGroupRef.current) return;
    const polyGroup = sitePolygonsLayerGroupRef.current;
    polyGroup.clearLayers();

    if (!showSitesLayer || !showSitePolygonsLayer) return;

    sites.forEach((site) => {
      const pinColor = site.isOffline ? '#EF4444' : '#1D5D9B';
      const validArea = site.area_size_hectares && site.area_size_hectares > 0 ? site.area_size_hectares : 1.0;
      const areaSqMeters = validArea * 10000;
      const radiusMeters = Math.sqrt(areaSqMeters / Math.PI);

      const areaCircle = L.circle([site.latitude, site.longitude], {
        radius: radiusMeters,
        color: pinColor,
        fillColor: pinColor,
        fillOpacity: 0.18,
        weight: 2,
        dashArray: '6, 6',
      });

      areaCircle.bindTooltip(
        `<div style="font-weight: 700; font-size: 11px; color: ${pinColor};">` +
        `<b>${site.site_name}</b><br/>Coverage: ${validArea.toFixed(2)} Ha (${Math.round(areaSqMeters).toLocaleString()} m²)` +
        `</div>`,
        { sticky: true, opacity: 0.95 }
      );

      areaCircle.on('click', () => {
        if (onSelectSite) onSelectSite(site);
      });

      polyGroup.addLayer(areaCircle);
    });
  }, [sites, showSitesLayer, showSitePolygonsLayer, onSelectSite]);

  // Render Site Markers
  useEffect(() => {
    if (!mapRef.current || !sitesLayerGroupRef.current) return;
    const sitesGroup = sitesLayerGroupRef.current;
    sitesGroup.clearLayers();

    if (!showSitesLayer) return;

    sites.forEach((site) => {
      const pinColor = site.isOffline ? '#EF4444' : '#1D5D9B';
      const isPending = site.is_pending_sync || site.isOffline;

      const customIcon = L.divIcon({
        className: 'custom-site-marker',
        html: `
          <div style="
            position: relative;
            background: ${pinColor};
            width: 32px;
            height: 32px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 2.5px solid #ffffff;
            box-shadow: 0 4px 12px rgba(0,0,0,0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          ">
            <span style="
              transform: rotate(45deg);
              font-size: 15px;
              color: white;
            ">🏢</span>
            ${isPending ? `
              <span style="
                position: absolute;
                top: -4px;
                right: -4px;
                width: 12px;
                height: 12px;
                background-color: #f59e0b;
                border: 2px solid white;
                border-radius: 50%;
                box-shadow: 0 0 4px rgba(0,0,0,0.4);
              "></span>
            ` : ''}
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

  // Render Reading Markers
  useEffect(() => {
    if (!mapRef.current || !readingsLayerGroupRef.current) return;
    const readingsGroup = readingsLayerGroupRef.current;
    readingsGroup.clearLayers();

    if (!showReadingsLayer) return;

    readings.forEach((reading) => {
      const color = getAmmoniaColor(reading.ammonia);
      const isPending = reading.is_pending_sync;

      const readingIcon = L.divIcon({
        className: 'custom-reading-marker',
        html: `
          <div style="
            position: relative;
            background: ${color};
            color: #ffffff;
            font-weight: 800;
            font-size: 11px;
            padding: 3px 8px;
            border-radius: 14px;
            border: 2px solid #ffffff;
            box-shadow: 0 3px 12px rgba(0,0,0,0.35);
            white-space: nowrap;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 3px;
          ">
            <span>📍 ${reading.ammonia.toFixed(1)}</span>
            <span style="font-size: 8px; opacity: 0.9;">PPM</span>
            ${isPending ? `
              <span style="
                position: absolute;
                top: -4px;
                right: -4px;
                width: 10px;
                height: 10px;
                background-color: #f59e0b;
                border: 2px solid white;
                border-radius: 50%;
              "></span>
            ` : ''}
          </div>
        `,
        iconSize: [64, 26],
        iconAnchor: [32, 13],
      });

      const marker = L.marker([reading.latitude, reading.longitude], {
        icon: readingIcon,
        zIndexOffset: 1000,
      });

      marker.on('click', () => {
        if (onSelectReading) onSelectReading(reading);
      });

      readingsGroup.addLayer(marker);
    });
  }, [readings, showReadingsLayer, onSelectReading]);

  // Render Photo Tag Markers
  useEffect(() => {
    if (!mapRef.current || !photoTagsLayerGroupRef.current) return;
    const photoGroup = photoTagsLayerGroupRef.current;
    photoGroup.clearLayers();

    if (!showPhotoTagsLayer) return;

    photoTags.forEach((tag) => {
      const isPending = tag.is_pending_sync;
      let photoIcon: L.DivIcon;

      if (tag.photo_url) {
        photoIcon = L.divIcon({
          className: 'custom-photo-thumb-marker',
          html: `
            <div style="
              position: relative;
              width: 38px;
              height: 38px;
              border-radius: 50%;
              border: 3px solid #8b5cf6;
              box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
              background: #0f172a;
              overflow: hidden;
              cursor: pointer;
            ">
              <img src="${tag.photo_url}" style="width: 100%; height: 100%; object-fit: cover;" alt="Site Tag" />
              ${isPending ? `
                <span style="
                  position: absolute;
                  top: 0;
                  right: 0;
                  width: 10px;
                  height: 10px;
                  background-color: #f59e0b;
                  border: 2px solid white;
                  border-radius: 50%;
                "></span>
              ` : ''}
            </div>
          `,
          iconSize: [38, 38],
          iconAnchor: [19, 19],
        });
      } else {
        photoIcon = L.divIcon({
          className: 'custom-photo-icon-marker',
          html: `
            <div style="
              position: relative;
              background: #8b5cf6;
              width: 30px;
              height: 30px;
              border-radius: 50%;
              border: 2px solid #ffffff;
              box-shadow: 0 3px 10px rgba(0,0,0,0.3);
              display: flex;
              align-items: center;
              justify-content: center;
              color: white;
              font-size: 15px;
              cursor: pointer;
            ">
              📷
            </div>
          `,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });
      }

      const marker = L.marker([tag.latitude, tag.longitude], { icon: photoIcon });

      marker.on('click', () => {
        if (onSelectPhotoTag) onSelectPhotoTag(tag);
      });

      photoGroup.addLayer(marker);
    });
  }, [photoTags, showPhotoTagsLayer, onSelectPhotoTag]);

  return (
    <div style={{ position: 'relative', width: '100%', height, overflow: 'hidden' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />
      <OdorZoneLayer
        map={mapInstance}
        odorZones={odorZones}
        showOdorZones={showOdorZonesLayer}
      />
    </div>
  );
};

export default FullMapView;
