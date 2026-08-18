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