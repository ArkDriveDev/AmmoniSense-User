import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './PolygonPreview.css';

export interface PolygonPreviewProps {
  center: [number, number]; // [lat, lng]
  areaHectares: number;
  color?: string;
  fillColor?: string;
  height?: string;
}

export const PolygonPreview: React.FC<PolygonPreviewProps> = ({
  center,
  areaHectares,
  color = '#1D5D9B',
  fillColor = '#1D5D9B',
  height = '220px',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  const [lat, lng] = center;
  const validLat = isNaN(lat) || lat === 0 ? 8.3683 : lat;
  const validLng = isNaN(lng) || lng === 0 ? 124.8637 : lng;
  const validArea = isNaN(areaHectares) || areaHectares <= 0 ? 1.0 : areaHectares;

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [validLat, validLng],
      zoom: 15,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    layerGroupRef.current = layerGroup;
    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update Geometry & Bounds on Props Change
  useEffect(() => {
    if (!mapRef.current || !layerGroupRef.current) return;

    const map = mapRef.current;
    const layerGroup = layerGroupRef.current;
    layerGroup.clearLayers();

    // 1 Ha = 10,000 m² -> Radius = sqrt(Area / PI)
    const areaSqMeters = validArea * 10000;
    const radiusMeters = Math.sqrt(areaSqMeters / Math.PI);

    // Dashed semi-transparent preview polygon / circle
    const circle = L.circle([validLat, validLng], {
      radius: radiusMeters,
      color: color,
      fillColor: fillColor,
      fillOpacity: 0.25,
      weight: 2.5,
      dashArray: '6, 6',
    });

    // Center point marker
    const centerMarker = L.circleMarker([validLat, validLng], {
      radius: 6,
      fillColor: color,
      color: '#ffffff',
      weight: 2,
      fillOpacity: 1,
    });

    // Area Label Badge at center
    const areaLabelText = `${validArea.toFixed(2)} Ha (${Math.round(areaSqMeters).toLocaleString()} m²)`;
    const labelIcon = L.divIcon({
      className: 'polygon-preview-label-marker',
      html: `<div class="preview-area-badge">${areaLabelText}</div>`,
      iconSize: [170, 28],
      iconAnchor: [85, 14],
    });