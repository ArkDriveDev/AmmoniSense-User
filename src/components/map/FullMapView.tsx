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
  showGridLayer?: boolean;
  showBoundaryLayer?: boolean;
  onSelectSite?: (site: SiteMarkerData) => void;
  onSelectReading?: (reading: ReadingMarkerData) => void;
  onSelectGridCell?: (cellId: string, cellReadings: ReadingMarkerData[]) => void;
  centerLat?: number;
  centerLng?: number;
  zoom?: number;
  userLocation?: { lat: number; lng: number } | null;
  height?: string;
}

// Manolo Fortich, Bukidnon Approximate Municipal Boundary Polygon
const MANOLO_FORTICH_BOUNDARY: [number, number][] = [
  [8.4350, 124.7700],
  [8.4550, 124.8400],
  [8.4480, 124.9100],
  [8.4100, 124.9500],
  [8.3500, 124.9750],
  [8.2900, 124.9300],
  [8.2750, 124.8600],
  [8.3050, 124.7800],
  [8.3650, 124.7600],
];

export const getSiteTypeColor = (type?: string): string => {
  const t = (type || '').toLowerCase();
  if (t.includes('piggery') || t.includes('pig')) return '#10b981'; // Green
  if (t.includes('ambient') || t.includes('agricultural') || t.includes('farm')) return '#3b82f6'; // Blue
  if (t.includes('industrial') || t.includes('factory')) return '#f59e0b'; // Amber / Orange
  if (t.includes('poultry') || t.includes('chicken')) return '#8b5cf6'; // Purple
  if (t.includes('river') || t.includes('water')) return '#06b6d4'; // Cyan / Teal
  return '#10b981'; // Default Green
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
  showGridLayer = true,
  showBoundaryLayer = true,
  onSelectSite,
  onSelectReading,
  onSelectGridCell,
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
  const gridLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const userLocLayerGroupRef = useRef<L.LayerGroup | null>(null);

  const [currentZoom, setCurrentZoom] = useState<number>(zoom);

  // Initialize Map Instance
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom: zoom,
      zoomControl: false, // We render custom zoom controls or let user interact
    });

    // Add high quality tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> | MENRO Manolo Fortich',
      maxZoom: 20,
    }).addTo(map);

    boundaryLayerGroupRef.current = L.layerGroup().addTo(map);
    sitesLayerGroupRef.current = L.layerGroup().addTo(map);
    readingsLayerGroupRef.current = L.layerGroup().addTo(map);
    gridLayerGroupRef.current = L.layerGroup().addTo(map);
    userLocLayerGroupRef.current = L.layerGroup().addTo(map);

    map.on('zoomend', () => {
      setCurrentZoom(map.getZoom());
    });

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update Center if changed
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setView([centerLat, centerLng], zoom);
    }
  }, [centerLat, centerLng, zoom]);

  // Render User GPS Location
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

      userMarker.bindPopup('<div style="font-weight: bold; color: #1e3a8a;">📍 Your Current Location</div>');

      userGroup.addLayer(pulseCircle);
      userGroup.addLayer(userMarker);
    }
  }, [userLocation]);

  // Render Municipal Boundary Layer
  useEffect(() => {
    if (!mapRef.current || !boundaryLayerGroupRef.current) return;
    const boundaryGroup = boundaryLayerGroupRef.current;
    boundaryGroup.clearLayers();

    if (showBoundaryLayer) {
      const polygon = L.polygon(MANOLO_FORTICH_BOUNDARY, {
        color: '#0f52ba',
        weight: 2.5,
        dashArray: '6, 6',
        fillColor: '#3880ff',
        fillOpacity: 0.05,
      });

      const labelIcon = L.divIcon({
        className: 'boundary-label-marker',
        html: `<div style="
          background: rgba(15, 60, 92, 0.85);
          color: white;
          padding: 4px 10px;
          border-radius: 12px;
          font-weight: bold;
          font-size: 11px;
          letter-spacing: 0.5px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.25);
          backdrop-filter: blur(4px);
          white-space: nowrap;
        ">🏛️ Manolo Fortich, Bukidnon Boundary</div>`,
        iconSize: [180, 24],
        iconAnchor: [90, 12],
      });

      const labelMarker = L.marker([8.42, 124.86], { icon: labelIcon, interactive: false });

      boundaryGroup.addLayer(polygon);
      boundaryGroup.addLayer(labelMarker);
    }
  }, [showBoundaryLayer]);

  // Render Monitoring Sites (Layer 1)
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

  // Render Sensor Data Readings (Layer 2)
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

      // Subtle pulse halo for critical readings
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

  // Render Spatial Grid Overlay (Layer 3)
  useEffect(() => {
    if (!mapRef.current || !gridLayerGroupRef.current) return;
    const gridGroup = gridLayerGroupRef.current;
    gridGroup.clearLayers();

    if (!showGridLayer) return;

    // Create 6x6 spatial grid around Manolo Fortich center
    const gridSize = 6;
    const cellDegreeOffset = 0.015; // ~1.5 km per cell

    const halfGrid = Math.floor(gridSize / 2);
    const startLat = centerLat - halfGrid * cellDegreeOffset;
    const startLng = centerLng - halfGrid * cellDegreeOffset;

    const cols = ['A', 'B', 'C', 'D', 'E', 'F'];

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const colLetter = cols[c] || `C${c + 1}`;
        const rowNum = r + 1;
        const cellId = `${colLetter}${rowNum}`;

        const south = startLat + r * cellDegreeOffset;
        const north = south + cellDegreeOffset;
        const west = startLng + c * cellDegreeOffset;
        const east = west + cellDegreeOffset;

        const bounds = L.latLngBounds([
          [south, west],
          [north, east],
        ]);
        const center = bounds.getCenter();

        // Calculate average ammonia in cell
        const cellReadings = readings.filter(rd => {
          if (rd.grid_cell_id && rd.grid_cell_id.toUpperCase() === cellId) return true;
          return bounds.contains([rd.latitude, rd.longitude]);
        });

        const avgAmmonia =
          cellReadings.length > 0
            ? cellReadings.reduce((sum, r) => sum + (r.ammonia || 0), 0) / cellReadings.length
            : null;

        const cellColor = avgAmmonia !== null ? getAmmoniaColor(avgAmmonia) : '#64748b';

        const rectangle = L.rectangle(bounds, {
          color: cellColor,
          weight: 1.5,
          fillColor: cellColor,
          fillOpacity: avgAmmonia !== null ? 0.12 : 0.03,
          dashArray: '4, 4',
        });

        const labelText = avgAmmonia !== null ? `${cellId} (${avgAmmonia.toFixed(1)} PPM)` : `${cellId}`;

        const labelIcon = L.divIcon({
          className: 'grid-overlay-label',
          html: `<div style="
            font-size: 10px;
            font-weight: 700;
            color: ${avgAmmonia !== null ? '#ffffff' : '#334155'};
            background: ${avgAmmonia !== null ? cellColor : 'rgba(255, 255, 255, 0.85)'};
            padding: 2px 6px;
            border-radius: 4px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            text-align: center;
            white-space: nowrap;
          ">${labelText}</div>`,
          iconSize: [80, 18],
          iconAnchor: [40, 9],
        });

        const labelMarker = L.marker(center, { icon: labelIcon, interactive: false });

        rectangle.on('click', () => {
          if (onSelectGridCell) onSelectGridCell(cellId, cellReadings);
        });

        gridGroup.addLayer(rectangle);
        gridGroup.addLayer(labelMarker);
      }
    }
  }, [centerLat, centerLng, readings, showGridLayer, onSelectGridCell]);

  return (
    <div style={{ position: 'relative', width: '100%', height, overflow: 'hidden' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%', zIndex: 1 }} />
    </div>
  );
};

export default FullMapView;
