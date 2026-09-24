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

  const rawLat = center && center[0] != null ? Number(center[0]) : NaN;
  const rawLng = center && center[1] != null ? Number(center[1]) : NaN;
  const validLat = (!rawLat || isNaN(rawLat) || rawLat === 0) ? 8.3683 : rawLat;
  const validLng = (!rawLng || isNaN(rawLng) || rawLng === 0) ? 124.8637 : rawLng;
  const numArea = Number(areaHectares);
  const validArea = (!numArea || isNaN(numArea) || numArea <= 0) ? 1.0 : numArea;

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

    // Invalidate size once container / modal transition completes
    const timers = [
      setTimeout(() => map.invalidateSize(), 100),
      setTimeout(() => map.invalidateSize(), 300),
      setTimeout(() => map.invalidateSize(), 600),
    ];

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && mapContainerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize();
        }
      });
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      timers.forEach(clearTimeout);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
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
    map.invalidateSize();

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

    const labelMarker = L.marker([validLat, validLng], {
      icon: labelIcon,
      interactive: false,
    });

    layerGroup.addLayer(circle);
    layerGroup.addLayer(centerMarker);
    layerGroup.addLayer(labelMarker);

    // Fit view to geometry with padding if map dimensions are valid
    try {
      const bounds = circle.getBounds();
      const mapSize = map.getSize();
      if (mapSize && mapSize.x > 0 && mapSize.y > 0 && bounds.isValid()) {
        map.fitBounds(bounds.pad(0.35));
      } else {
        map.setView([validLat, validLng], 15);
      }
    } catch {
      map.setView([validLat, validLng], 15);
    }
  }, [validLat, validLng, validArea, color, fillColor]);

  return (
    <div className="polygon-preview-container" style={{ height }}>
      <div ref={mapContainerRef} className="polygon-preview-map" />
    </div>
  );
};

export default PolygonPreview;
