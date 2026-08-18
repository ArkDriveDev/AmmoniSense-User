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