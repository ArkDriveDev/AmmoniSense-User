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
  height = '420px',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const gridLayerGroupRef = useRef<L.LayerGroup | null>(null);
  const markersLayerGroupRef = useRef<L.LayerGroup | null>(null);

  const [activeCellId, setActiveCellId] = useState<string>(selectedCellId);
  const [currentZoom, setCurrentZoom] = useState<number>(zoom);

  useEffect(() => {
    setActiveCellId(selectedCellId);
  }, [selectedCellId]);

  // Initialize Leaflet Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Clean up existing map instance if re-mounting
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      center: [centerLat, centerLng],
      zoom: zoom,
      zoomControl: true,
    });

    // Add OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | MENRO',
      maxZoom: 21,
    }).addTo(map);

    gridLayerGroupRef.current = L.layerGroup().addTo(map);
    markersLayerGroupRef.current = L.layerGroup().addTo(map);

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

  // Update map center when props change
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setView([centerLat, centerLng], currentZoom);
    }
  }, [centerLat, centerLng]);

  // Draw Grid Overlay & Previous Readings
  useEffect(() => {
    if (!mapRef.current || !gridLayerGroupRef.current || !markersLayerGroupRef.current) return;

    const gridGroup = gridLayerGroupRef.current;
    const markersGroup = markersLayerGroupRef.current;

    gridGroup.clearLayers();
    markersGroup.clearLayers();

    // 1. Calculate Grid Cells
    // Adjust cell size dynamically based on zoom level
    let effectiveCellMeters = cellSizeMeters;
    if (currentZoom < 16) {
      effectiveCellMeters = cellSizeMeters * 2;
    } else if (currentZoom >= 19) {
      effectiveCellMeters = cellSizeMeters / 2;
    }

    const { latOffset, lngOffset } = metersToLatLngOffset(effectiveCellMeters, centerLat);

    const halfGrid = Math.floor(gridSize / 2);
    const startLat = centerLat - halfGrid * latOffset;
    const startLng = centerLng - halfGrid * lngOffset;

    const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const colLetter = cols[c] || `C${c + 1}`;
        const rowNum = r + 1;
        const cellId = `${colLetter}${rowNum}`;

        const south = startLat + r * latOffset;
        const north = south + latOffset;
        const west = startLng + c * lngOffset;
        const east = west + lngOffset;

        const bounds = L.latLngBounds([
          [south, west],
          [north, east],
        ]);
        const center = bounds.getCenter();

        const isSelected = activeCellId === cellId;

        // Polygon styling
        const rectangle = L.rectangle(bounds, {
          color: isSelected ? '#3880ff' : '#2dd36f',
          weight: isSelected ? 3 : 1.5,
          fillColor: isSelected ? '#3880ff' : '#2dd36f',
          fillOpacity: isSelected ? 0.35 : 0.08,
          dashArray: isSelected ? undefined : '4, 4',
        });

        // Label in the center of cell
        const labelIcon = L.divIcon({
          className: 'grid-cell-label',
          html: `<div style="
            font-weight: bold;