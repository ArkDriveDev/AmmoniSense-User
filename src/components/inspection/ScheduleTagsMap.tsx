import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { InspectionTag } from '../../types/inspection';
import { getAmmoniaColor } from '../map/FullMapView';

interface ScheduleTagsMapProps {
  tags: InspectionTag[];
  height?: string;
  onSelectTag?: (tag: InspectionTag) => void;
}

export const ScheduleTagsMap: React.FC<ScheduleTagsMapProps> = ({ tags, height = '360px', onSelectTag }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    const defaultLat = tags.length > 0 ? tags[0].latitude : 8.3683;
    const defaultLng = tags.length > 0 ? tags[0].longitude : 124.8637;

    const map = L.map(mapContainerRef.current, { center: [defaultLat, defaultLng], zoom: 16, zoomControl: true, attributionControl: false });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
    layerGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const timer = setTimeout(() => map.invalidateSize(), 200);
    return () => { clearTimeout(timer); map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layerGroup = layerGroupRef.current;
    if (!map || !layerGroup) return;
    layerGroup.clearLayers();

    const bounds: [number, number][] = [];
    tags.forEach((tag) => {
      const lat = Number(tag.latitude);
      const lng = Number(tag.longitude);
      if (isNaN(lat) || isNaN(lng)) return;
      bounds.push([lat, lng]);

      const color = getAmmoniaColor(tag.ammonia);
      const icon = L.divIcon({
        className: 'schedule-tag-marker',
        html: `<div style="background:${color};color:#fff;font-weight:800;font-size:11px;padding:3px 8px;border-radius:12px;border:2px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,0.35);display:flex;align-items:center;gap:3px;white-space:nowrap;cursor:pointer;"><span>📍 ${tag.ammonia.toFixed(1)}</span><span style="font-size:9px;opacity:0.9;">PPM</span></div>`,
        iconSize: [60, 26],
        iconAnchor: [30, 13],
      });

      const photoHtml = (tag.photo_thumbnail_url || tag.photo_url)
        ? `<div style="margin-top:6px;"><img src="${tag.photo_thumbnail_url || tag.photo_url}" style="width:100%;max-height:100px;object-fit:cover;border-radius:6px;" alt="${tag.tag_name}"/></div>`
        : '';

      const popup = `<div style="font-family:sans-serif;min-width:180px;font-size:12px;color:#1E293B;">
        <div style="font-weight:800;font-size:13px;color:#0F172A;margin-bottom:2px;">${tag.tag_name}</div>
        <div style="display:inline-block;padding:2px 6px;border-radius:4px;background:${color};color:#fff;font-weight:700;font-size:11px;margin-bottom:4px;">${tag.ammonia.toFixed(1)} PPM (${tag.status || 'NORMAL'})</div>
        <div style="color:#64748B;font-size:11px;">Temp: ${tag.temperature ?? '--'}°C | Hum: ${tag.humidity ?? '--'}% | Bat: ${tag.battery ?? '--'}%</div>
        ${tag.notes ? `<div style="margin-top:4px;font-style:italic;color:#475569;">"${tag.notes}"</div>` : ''}
        ${photoHtml}
      </div>`;

      const marker = L.marker([lat, lng], { icon }).bindPopup(popup);
      marker.on('click', () => { if (onSelectTag) onSelectTag(tag); });
      layerGroup.addLayer(marker);
    });

    if (bounds.length > 1) map.fitBounds(bounds, { padding: [35, 35], maxZoom: 18 });
    else if (bounds.length === 1) map.setView(bounds[0], 17);
  }, [tags, onSelectTag]);

  return (
    <div style={{ position: 'relative', width: '100%', height, borderRadius: '14px', overflow: 'hidden', border: '1px solid #CBD5E1', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
      {tags.length === 0 && (
        <div style={{ position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,0.95)', padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, color: '#64748B', boxShadow: '0 2px 6px rgba(0,0,0,0.15)', pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 1000 }}>
          No tags recorded yet on this schedule
        </div>
      )}
    </div>
  );
};
export default ScheduleTagsMap;
