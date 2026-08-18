import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface GridCell {
  id: string;
  bounds: L.LatLngBounds;
  center: L.LatLng;
  row: number;
  col: number;
}

export interface SensorReadingMarker {
  id: number | string;
  latitude: number;
  longitude: number;
  ammonia: number;
  grid_cell_id?: string;
  device_uid?: string;
  created_at: string;
  photo_url?: string;
}

interface SiteGridMapProps {
  centerLat?: number;
  centerLng?: number;
  zoom?: number;
  siteName?: string;
  readings?: SensorReadingMarker[];
  selectedCellId?: string;
  onSelectCell?: (cellId: string, lat: number, lng: number) => void;
  gridSize?: number; // Number of rows/cols (e.g., 6 for 6x6)
  cellSizeMeters?: number; // Size of each cell in meters (e.g., 50m)
  height?: string;
}

// Convert meters to approximate lat/lng offset
const metersToLatLngOffset = (meters: number, lat: number) => {
  const latOffset = meters / 111111;
  const lngOffset = meters / (111111 * Math.cos((lat * Math.PI) / 180));
  return { latOffset, lngOffset };
};

const getStatusColor = (ammonia: number) => {
  if (ammonia > 50) return '#eb445a'; // Danger Red
  if (ammonia > 25) return '#ffc409'; // Warning Yellow
  return '#2dd36f'; // Normal Green
};

export const SiteGridMap: React.FC<SiteGridMapProps> = ({
  centerLat = 14.5995,
  centerLng = 120.9842,
  zoom = 18,
  siteName = 'Monitoring Site',
  readings = [],
  selectedCellId = '',
  onSelectCell,
  gridSize = 6,
  cellSizeMeters = 50,