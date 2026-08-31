import React, { useEffect } from 'react';
import L from 'leaflet';
import { OdorZone } from '../../types/site';
import { fromGeoJSONPolygon, calculatePolygonCenter, calculatePolygonAreaHectares } from '../../utils/spatialUtils';

export interface OdorZoneLayerProps {
  map: L.Map | null;
  odorZones?: OdorZone[];
  showOdorZones?: boolean;
}

export const OdorZoneLayer: React.FC<OdorZoneLayerProps> = ({
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
          ? fromGeoJSONPolygon(zone.coordinates)
          : (zone.polygon_geojson ? fromGeoJSONPolygon(zone.polygon_geojson) : []);

        if (!coords || coords.length < 3) return;

        // Visual Design: Semi-transparent orange polygon (#f59e0b / #fbbf24) with dashed border
        const poly = L.polygon(coords, {
          color: '#d97706',
          weight: 2.5,
          dashArray: '6, 6',
          fillColor: '#fbbf24',
          fillOpacity: 0.28,
        });

        const calculatedArea = calculatePolygonAreaHectares(coords);
        const areaHa = zone.area_size_hectares || (calculatedArea > 0 ? calculatedArea : null);

        const center = calculatePolygonCenter(coords) || {
          lat: coords.reduce((sum, c) => sum + c[0], 0) / coords.length,
          lng: coords.reduce((sum, c) => sum + c[1], 0) / coords.length,
        };

        const labelIcon = L.divIcon({
          className: 'odor-zone-center-label',
          html: `
            <div style="
              background: rgba(254, 243, 199, 0.95);
              color: #92400e;
              padding: 2px 7px;
              border-radius: 6px;
              font-size: 11px;
              font-weight: 700;
              border: 1px solid #f59e0b;
              box-shadow: 0 2px 6px rgba(0,0,0,0.15);
              white-space: nowrap;
              text-align: center;
              cursor: pointer;
            ">
              <span>🟧 ${zone.zone_name}</span>
              ${areaHa ? `<span style="font-size: 9px; opacity: 0.9; margin-left: 3px;">(${areaHa} ha)</span>` : ''}
            </div>
          `,
          iconAnchor: [45, 11],
        });

        const centerMarker = L.marker([center.lat, center.lng], { icon: labelIcon, interactive: true });

        const popupContent = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 4px; min-width: 180px;">
            <div style="font-size: 11px; font-weight: 800; color: #d97706; text-transform: uppercase; letter-spacing: 0.5px;">🟧 ODOR IMPACT ZONE</div>
            <strong style="color: #0F172A; font-size: 15px; display: block; margin: 2px 0 6px 0;">${zone.zone_name}</strong>
            <div style="font-size: 12px; color: #334155; line-height: 1.5;">
              ${zone.site_name ? `<b>Site:</b> ${zone.site_name}<br/>` : ''}
              <b>Area:</b> ${areaHa ? `${areaHa} ha` : 'Calculated'}<br/>
              <b>Readings:</b> ${zone.reading_count !== undefined ? zone.reading_count : 0} readings<br/>
              ${zone.avg_ammonia !== undefined ? `<b>Avg NH₃:</b> ${zone.avg_ammonia.toFixed(1)} ppm<br/>` : ''}
              ${zone.max_ammonia !== undefined ? `<b>Max NH₃:</b> ${zone.max_ammonia.toFixed(1)} ppm<br/>` : ''}
              ${zone.notes ? `<div style="margin-top: 4px; font-style: italic; color: #64748b;">${zone.notes}</div>` : ''}
            </div>
          </div>
        `;

        poly.bindPopup(popupContent);
        centerMarker.bindPopup(popupContent);

        odorGroup.addLayer(poly);
        odorGroup.addLayer(centerMarker);
      });
    }

    return () => {
      map.removeLayer(odorGroup);
    };
  }, [map, odorZones, showOdorZones]);

  return null;
};

export default OdorZoneLayer;
