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