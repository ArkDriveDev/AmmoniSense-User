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
  IonTextarea
} from '@ionic/react';
import {
  shapesOutline,
  refreshOutline,
  checkmarkCircleOutline,
  trashOutline,
  saveOutline,
  businessOutline
} from 'ionicons/icons';
import { MANOLO_FORTICH_BOUNDS } from './FullMapView';
import { OdorZone } from '../../types/site';
import { toGeoJSONPolygon, calculatePolygonAreaHectares, calculatePolygonCenter } from '../../utils/spatialUtils';

interface PolygonDrawerProps {
  centerLat?: number;
  centerLng?: number;
  zoom?: number;
  height?: string;
  selectedSiteId?: number | null;
  sites?: Array<{ id: number; site_name: string; site_code?: string }>;
  onSaveOdorZone?: (zone: OdorZone) => void;
}

export const PolygonDrawer: React.FC<PolygonDrawerProps> = ({
  centerLat = 8.3683,
  centerLng = 124.8637,
  zoom = 14,
  height = '420px',
  selectedSiteId: initialSiteId = null,
  sites = [],
  onSaveOdorZone,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const polygonRef = useRef<L.Polygon | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  // Draw State
  const [vertices, setVertices] = useState<[number, number][]>([]);

  // Odor Zone Form State
  const [siteId, setSiteId] = useState<number | null>(initialSiteId || (sites.length > 0 ? sites[0].id : null));
  const [zoneName, setZoneName] = useState<string>('Odor Impact Zone 1');
  const [notes, setNotes] = useState<string>('');

  // Computed Surface Area (Hectares)
  const [surfaceAreaHa, setSurfaceAreaHa] = useState<number>(0);

  // Sync initialSiteId when prop changes
  useEffect(() => {
    if (initialSiteId !== undefined && initialSiteId !== null) {
      setSiteId(initialSiteId);
    } else if (!siteId && sites.length > 0) {
      setSiteId(sites[0].id);
    }
  }, [initialSiteId, sites]);

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
      attribution: '&copy; OpenStreetMap | AmmoniSense Odor Zone Drawer',
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

  // Map click handler to capture polygon vertices
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

    const color = '#f97316'; // Odor Zone Orange

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
      const geojson = toGeoJSONPolygon(vertices);
      const area = calculatePolygonAreaHectares(geojson);
      setSurfaceAreaHa(area);
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
  }, [vertices]);

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

    if (!siteId) {
      alert('Please select a monitoring site for this odor zone.');
      return;
    }

    try {
      const polygonGeojson = toGeoJSONPolygon(vertices);
      const center = calculatePolygonCenter(polygonGeojson);
      const area = calculatePolygonAreaHectares(polygonGeojson);

      const zone: OdorZone = {
        site_id: siteId,
        zone_name: zoneName.trim() || 'Odor Impact Zone',
        polygon_geojson: polygonGeojson,
        center_latitude: center?.lat || null,
        center_longitude: center?.lng || null,
        area_size_hectares: area,
        coordinates: vertices,
        notes: notes.trim() || null,
      };

      if (onSaveOdorZone) onSaveOdorZone(zone);
      handleClear();
    } catch (err: any) {
      alert('Error creating polygon: ' + err.message);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      {/* Top Header Card */}
      <IonCard className="premium-card" style={{ margin: '0 0 12px 0', padding: '12px' }}>
        <IonCardContent style={{ padding: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IonBadge style={{ background: '#f97316', color: '#ffffff', fontSize: '12px', fontWeight: 700 }}>
                🟧 Odor Zone Boundary
              </IonBadge>
              <IonBadge style={{ background: '#E2E8F0', color: '#334155', fontSize: '11px', fontWeight: 700 }}>
                {vertices.length} Vertices
              </IonBadge>
            </div>

            {surfaceAreaHa > 0 && (
              <IonBadge style={{ background: 'rgba(249, 115, 22, 0.15)', color: '#c2410c', fontSize: '12px', fontWeight: 800 }}>
                Estimated Area: {surfaceAreaHa} ha
              </IonBadge>
            )}
          </div>
        </IonCardContent>
      </IonCard>

      {/* Map Container */}
      <div style={{ position: 'relative', width: '100%', height, borderRadius: '12px', overflow: 'hidden', border: '2px solid #CBD5E1' }}>
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%', cursor: 'crosshair' }} />

        {/* Map Drawing Overlay Instruction Banner */}
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          zIndex: 1000,
          background: 'rgba(15, 23, 42, 0.88)',
          color: '#ffffff',
          padding: '6px 14px',
          borderRadius: '20px',
          fontSize: '11px',
          fontWeight: 700,
          backdropFilter: 'blur(6px)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
          border: '1px solid rgba(255,255,255,0.2)'
        }}>
          📍 Tap map to add odor zone vertices ({vertices.length}/3+ points)
        </div>

        {/* Drawing Action Buttons (Undo / Clear) */}
        <div style={{ position: 'absolute', bottom: '12px', right: '12px', zIndex: 1000, display: 'flex', gap: '8px' }}>
          <IonButton size="small" fill="solid" color="medium" onClick={handleUndo} disabled={vertices.length === 0}>
            Undo Point
          </IonButton>
          <IonButton size="small" fill="solid" color="danger" onClick={handleClear} disabled={vertices.length === 0}>
            <IonIcon icon={trashOutline} slot="start" />
            Clear
          </IonButton>
        </div>
      </div>

      {/* Odor Zone Meta Form Controls */}
      <IonCard className="premium-card" style={{ margin: '12px 0 0 0', padding: '14px' }}>
        <IonCardContent style={{ padding: '0' }}>
          {sites.length > 0 && (
            <IonItem lines="full" style={{ marginBottom: '8px' }}>
              <IonIcon icon={businessOutline} slot="start" color="primary" />
              <IonLabel position="stacked" style={{ fontWeight: 700 }}>Monitoring Site</IonLabel>
              <IonSelect
                value={siteId}
                placeholder="Select Site"
                onIonChange={(e) => setSiteId(e.detail.value)}
              >
                {sites.map((s) => (
                  <IonSelectOption key={s.id} value={s.id}>
                    {s.site_name} {s.site_code ? `(${s.site_code})` : ''}
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>
          )}

          <IonItem lines="full" style={{ marginBottom: '8px' }}>
            <IonLabel position="stacked" style={{ fontWeight: 700 }}>Odor Zone Name</IonLabel>
            <IonInput
              value={zoneName}
              onIonChange={(e) => setZoneName(e.detail.value!)}
              placeholder="e.g. Silang Odor Plume Zone 1"
            />
          </IonItem>

          <IonItem lines="full" style={{ marginBottom: '8px' }}>
            <IonLabel position="stacked" style={{ fontWeight: 700 }}>Notes / Description (Optional)</IonLabel>
            <IonTextarea
              value={notes}
              onIonChange={(e) => setNotes(e.detail.value!)}
              placeholder="e.g. Covers downstream perimeter of composting unit"
              rows={2}
            />
          </IonItem>

          <IonButton
            expand="block"
            color="warning"
            size="large"
            onClick={handleSaveShape}
            disabled={vertices.length < 3 || !siteId}
            style={{ marginTop: '14px', fontWeight: 700 }}
          >
            <IonIcon icon={saveOutline} slot="start" />
            Save 🟧 Odor Zone Polygon
          </IonButton>
        </IonCardContent>
      </IonCard>
    </div>
  );
};

export default PolygonDrawer;
