import React, { useEffect } from 'react';
import L from 'leaflet';
import { OdorZone } from '../../types/site';
import { fromGeoJSONPolygon } from '../../utils/spatialUtils';

interface OdorZonePolygonLayerProps {
  map: L.Map | null;
  odorZones?: OdorZone[];
  showOdorZones?: boolean;
}

export const OdorZonePolygonLayer: React.FC<OdorZonePolygonLayerProps> = ({
  map,
  odorZones = [],
  showOdorZones = true,
}) => {
  useEffect(() => {
    if (!map) return;

    const odorGroup = L.layerGroup().addTo(map);

    if (showOdorZones) {
      odorZones.forEach((zone) => {
        const coords = zone.coordinates && zone.coordinates.length >= 3
          ? zone.coordinates
          : (zone.polygon_geojson ? fromGeoJSONPolygon(zone.polygon_geojson) : []);

        if (!coords || coords.length < 3) return;

        const avgPpm = zone.avg_ammonia ?? zone.ammonia_ppm ?? 0;
        const color = avgPpm > 20 ? '#ef4444' : avgPpm > 10 ? '#f97316' : '#eab308';

        const poly = L.polygon(coords, {
          color: color,
          weight: 2.5,
          dashArray: '6, 6',
          fillColor: color,
          fillOpacity: 0.3,
        });

        poly.bindPopup(`
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 4px; min-width: 180px;">
            <div style="font-size: 11px; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px;">🟧 ODOR IMPACT ZONE</div>
            <strong style="color: #0F172A; font-size: 15px; display: block; margin: 2px 0 6px 0;">${zone.zone_name}</strong>
            <div style="font-size: 12px; color: #334155; line-height: 1.5;">
              ${zone.site_name ? `<b>Site:</b> ${zone.site_name}<br/>` : ''}
              <b>Area:</b> ${zone.area_size_hectares ? `${zone.area_size_hectares} ha` : 'Calculated'}<br/>
              <b>Readings:</b> ${zone.reading_count !== undefined ? zone.reading_count : 0} readings<br/>
              ${zone.avg_ammonia !== undefined ? `<b>Avg NH₃:</b> ${zone.avg_ammonia.toFixed(1)} ppm<br/>` : ''}
              ${zone.max_ammonia !== undefined ? `<b>Max NH₃:</b> ${zone.max_ammonia.toFixed(1)} ppm<br/>` : ''}
              ${zone.notes ? `<i>${zone.notes}</i>` : ''}
            </div>
          </div>
        `);

        odorGroup.addLayer(poly);
      });
    }

    return () => {
      map.removeLayer(odorGroup);
    };
  }, [map, odorZones, showOdorZones]);

  return null;
};

export default OdorZonePolygonLayer;
