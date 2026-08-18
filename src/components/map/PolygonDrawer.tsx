import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  IonCard,
  IonCardContent,
  IonButton,
  IonIcon,
  IonItem,
  IonLabel,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonBadge,
  IonChip
} from '@ionic/react';
import {
  shapesOutline,
  refreshOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  trashOutline,
  saveOutline,
  addOutline
} from 'ionicons/icons';
import { MANOLO_FORTICH_BOUNDS } from './FullMapView';
import { OdorZone, CommunityPolygon } from '../../types/site';

interface PolygonDrawerProps {
  centerLat?: number;
  centerLng?: number;
  zoom?: number;
  height?: string;
  onSaveOdorZone?: (zone: OdorZone) => void;
  onSaveCommunity?: (community: CommunityPolygon) => void;
}

export const PolygonDrawer: React.FC<PolygonDrawerProps> = ({
  centerLat = 8.3683,
  centerLng = 124.8637,
  zoom = 14,
  height = '420px',
  onSaveOdorZone,
  onSaveCommunity,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const polygonRef = useRef<L.Polygon | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  // Draw State
  const [vertices, setVertices] = useState<[number, number][]>([]);
  const [drawingMode, setDrawingMode] = useState<'odor_zone' | 'community'>('odor_zone');

  // Odor Zone Form State
  const [zoneName, setZoneName] = useState<string>('Odor Impact Zone A');
  const [severityLevel, setSeverityLevel] = useState<'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'>('HIGH');
  const [ammoniaPpm, setAmmoniaPpm] = useState<string>('24.5');

  // Community Form State
  const [communityName, setCommunityName] = useState<string>('Poblacion Community');
  const [communityType, setCommunityType] = useState<'Residential' | 'School' | 'Hospital' | 'Commercial' | 'Agricultural'>('Residential');
  const [population, setPopulation] = useState<string>('1200');

  // Computed Surface Area (Hectares)
  const [surfaceAreaHa, setSurfaceAreaHa] = useState<number>(0);

  // Initialize Leaflet Map Instance
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
      zoomControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap | MENRO Polygon Drawer',
      maxZoom: 20,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update map click handler to capture polygon vertices
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      const newPoint: [number, number] = [e.latlng.lat, e.latlng.lng];
      setVertices((prev) => [...prev, newPoint]);
    };

    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
    };
  }, []);

  // Render vertices, preview polyline, and polygon on map
  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;

    // Clear existing markers & shapes
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];

    if (polylineRef.current) {
      map.removeLayer(polylineRef.current);
      polylineRef.current = null;
    }

    if (polygonRef.current) {
      map.removeLayer(polygonRef.current);
      polygonRef.current = null;
    }

    const color = drawingMode === 'odor_zone' ? '#f97316' : '#22c55e'; // Orange for Odor Zone, Green for Community

    // Render vertex markers
    vertices.forEach((pt, index) => {
      const marker = L.circleMarker(pt, {
        radius: 6,
        fillColor: color,
        color: '#ffffff',
        weight: 2,
        fillOpacity: 1,
      }).bindTooltip(`Vertex #${index + 1}`);

      marker.addTo(map);
      markersRef.current.push(marker as any);
    });

    // Render connecting polyline / closed polygon preview
    if (vertices.length >= 3) {
      const poly = L.polygon(vertices, {
        color: color,
        weight: 2.5,
        fillColor: color,
        fillOpacity: 0.25,
        dashArray: '5, 5',
      }).addTo(map);

      polygonRef.current = poly;
      calculateSurfaceArea(vertices);
    } else if (vertices.length === 2) {
      const line = L.polyline(vertices, {
        color: color,
        weight: 2,
        dashArray: '4, 4',
      }).addTo(map);

      polylineRef.current = line;
      setSurfaceAreaHa(0);
    } else {
      setSurfaceAreaHa(0);
    }
  }, [vertices, drawingMode]);

  // Calculate polygon surface area in hectares
  const calculateSurfaceArea = (pts: [number, number][]) => {
    if (pts.length < 3) return;
    // Simple Shoelace formula converted to approximate square meters / hectares
    let area = 0;
    const R = 6378137; // Earth radius in meters
    const degToRad = Math.PI / 180;

    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];

      const x1 = p1[1] * degToRad * R * Math.cos(p1[0] * degToRad);
      const y1 = p1[0] * degToRad * R;
      const x2 = p2[1] * degToRad * R * Math.cos(p2[0] * degToRad);
      const y2 = p2[0] * degToRad * R;

      area += x1 * y2 - x2 * y1;
    }

    const areaSqMeters = Math.abs(area / 2);
    const areaHa = areaSqMeters / 10000;
    setSurfaceAreaHa(parseFloat(areaHa.toFixed(2)));
  };

  const handleUndo = () => {
    setVertices((prev) => prev.slice(0, prev.length - 1));
  };

  const handleClear = () => {
    setVertices([]);
    setSurfaceAreaHa(0);
  };

  const handleSaveShape = () => {
    if (vertices.length < 3) {
      alert('Please click on the map to place at least 3 vertices to form a polygon.');
      return;
    }

    if (drawingMode === 'odor_zone') {