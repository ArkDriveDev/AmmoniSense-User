import React, { useEffect, useRef } from 'react';
import { IonItem, IonLabel, IonInput, IonButton, IonIcon } from '@ionic/react';
import { locateOutline, arrowForwardOutline } from 'ionicons/icons';
import { Geolocation } from '@capacitor/geolocation';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface Props {
  lat: number;
  lng: number;
  onChangeLat: (v: number) => void;
  onChangeLng: (v: number) => void;
  onNext: () => void;
}

export const TagLocationStep: React.FC<Props> = ({ lat, lng, onChangeLat, onChangeLng, onNext }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const validLat = lat || 8.3683;
  const validLng = lng || 124.8637;

  useEffect(() => {
    if (!mapContainerRef.current) return;
    const map = L.map(mapContainerRef.current, { center: [validLat, validLng], zoom: 16, zoomControl: false, attributionControl: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    const pin = L.divIcon({
      className: 'custom-tag-pin',
      html: `<div style="background:#1D5D9B;color:#fff;width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,0.4);border:2px solid #fff;font-size:14px;cursor:pointer;">📍</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 28],
    });

    const marker = L.marker([validLat, validLng], { draggable: true, icon: pin }).addTo(map);
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      onChangeLat(parseFloat(pos.lat.toFixed(6)));
      onChangeLng(parseFloat(pos.lng.toFixed(6)));
    });
    map.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      onChangeLat(parseFloat(e.latlng.lat.toFixed(6)));
      onChangeLng(parseFloat(e.latlng.lng.toFixed(6)));
    });

    mapRef.current = map;
    markerRef.current = marker;
    const timer = setTimeout(() => map.invalidateSize(), 200);
    return () => { clearTimeout(timer); map.remove(); mapRef.current = null; markerRef.current = null; };
  }, []);

  useEffect(() => {
    if (markerRef.current && mapRef.current) {
      markerRef.current.setLatLng([validLat, validLng]);
      mapRef.current.setView([validLat, validLng], mapRef.current.getZoom());
    }
  }, [validLat, validLng]);

  const refreshGPS = () => {
    Geolocation.getCurrentPosition({ enableHighAccuracy: true })
      .then((p) => {
        onChangeLat(parseFloat(p.coords.latitude.toFixed(6)));
        onChangeLng(parseFloat(p.coords.longitude.toFixed(6)));
      })
      .catch((e) => console.warn('GPS notice:', e));
  };

  return (
    <div>
      <h4 style={{ margin: '0 0 4px 0', fontWeight: 700 }}>Step 1: Tag Location</h4>
      <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#64748B' }}>Drag marker or tap map to position tag.</p>
      <div ref={mapContainerRef} style={{ height: '180px', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid #CBD5E1', marginBottom: '10px' }} />
      <IonItem lines="inset">
        <IonLabel position="stacked">LATITUDE</IonLabel>
        <IonInput type="number" value={lat} onIonInput={(e) => onChangeLat(Number(e.detail.value))} />
      </IonItem>
      <IonItem lines="inset" style={{ marginTop: '8px' }}>
        <IonLabel position="stacked">LONGITUDE</IonLabel>
        <IonInput type="number" value={lng} onIonInput={(e) => onChangeLng(Number(e.detail.value))} />
      </IonItem>
      <IonButton expand="block" fill="outline" style={{ marginTop: '12px' }} onClick={refreshGPS}>
        <IonIcon icon={locateOutline} slot="start" /> Re-acquire GPS
      </IonButton>
      <IonButton expand="block" style={{ marginTop: '16px' }} onClick={onNext}>
        Next: Sensor Reading <IonIcon icon={arrowForwardOutline} slot="end" />
      </IonButton>
    </div>
  );
};
export default TagLocationStep;
