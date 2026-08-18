import React, { useEffect } from 'react';
import L from 'leaflet';
import { OdorZone, CommunityPolygon } from '../../types/site';

interface OdorZonePolygonLayerProps {
  map: L.Map | null;
  odorZones?: OdorZone[];
  communityPolygons?: CommunityPolygon[];
  showOdorZones?: boolean;
  showCommunities?: boolean;
}

export const OdorZonePolygonLayer: React.FC<OdorZonePolygonLayerProps> = ({
  map,
  odorZones = [],
  communityPolygons = [],
  showOdorZones = true,
  showCommunities = true,
}) => {
  useEffect(() => {
    if (!map) return;

    const odorGroup = L.layerGroup().addTo(map);
    const commGroup = L.layerGroup().addTo(map);

    // 1. Render Odor Zone Polygons (🟧 Orange / Red)
    if (showOdorZones) {
      odorZones.forEach((zone) => {
        if (!zone.coordinates || zone.coordinates.length < 3) return;

        const isCritical = zone.severity_level === 'CRITICAL';
        const isHigh = zone.severity_level === 'HIGH';
        const color = isCritical ? '#ef4444' : isHigh ? '#f97316' : '#eab308';

        const poly = L.polygon(zone.coordinates, {
          color: color,
          weight: 2.5,
          dashArray: '6, 6',
          fillColor: color,
          fillOpacity: 0.35,
        });

        poly.bindPopup(`
          <div style="font-family: sans-serif; padding: 4px;">
            <strong style="color: ${color}; font-size: 14px;">🟧 ${zone.zone_name}</strong>
            <div style="margin-top: 4px; font-size: 12px; color: #475569;">
              <b>Severity Level:</b> ${zone.severity_level}<br/>
              <b>Ammonia NH₃:</b> ${zone.ammonia_ppm || 0} ppm<br/>
              <b>Polygon Vertices:</b> ${zone.coordinates.length} points
            </div>
          </div>
        `);

        odorGroup.addLayer(poly);
      });
    }

    // 2. Render Vulnerable Community Polygons (🟩 Green)
    if (showCommunities) {
      communityPolygons.forEach((comm) => {
        if (!comm.coordinates || comm.coordinates.length < 3) return;

        const poly = L.polygon(comm.coordinates, {
          color: '#10b981',
          weight: 2.5,
          dashArray: '4, 4',
          fillColor: '#2dd36f',
          fillOpacity: 0.25,
        });

        const iconEmoji = comm.community_type === 'School' ? '🏫' : comm.community_type === 'Hospital' ? '🏥' : '🏡';

        poly.bindPopup(`
          <div style="font-family: sans-serif; padding: 4px;">
            <strong style="color: #059669; font-size: 14px;">${iconEmoji} ${comm.community_name}</strong>
            <div style="margin-top: 4px; font-size: 12px; color: #475569;">
              <b>Type:</b> ${comm.community_type} Zone<br/>
              <b>Est. Population:</b> ${(comm.estimated_population || 0).toLocaleString()} Residents
            </div>
          </div>
        `);

        commGroup.addLayer(poly);
      });
    }

    return () => {
      map.removeLayer(odorGroup);
      map.removeLayer(commGroup);
    };
  }, [map, odorZones, communityPolygons, showOdorZones, showCommunities]);

  return null;
};

export default OdorZonePolygonLayer;


export default OdorZonePolygonLayer;
