import React, { useEffect } from 'react';
import L from 'leaflet';
import { ReadingMarkerData, SiteMarkerData } from './FullMapView';

interface OdorZonePolygonLayerProps {
  map: L.Map | null;
  readings?: ReadingMarkerData[];
  sites?: SiteMarkerData[];
  showOdorZones?: boolean;
}

export const OdorZonePolygonLayer: React.FC<OdorZonePolygonLayerProps> = ({
  map,
  readings = [],
  sites = [],
  showOdorZones = true,
}) => {
  useEffect(() => {
    if (!map) return;

    const odorLayerGroup = L.layerGroup().addTo(map);

    // Render Ammonia Spatial Odor Dispersion Plumes directly from real sensor readings
    if (showOdorZones) {
      readings.forEach((reading) => {
        if (!reading.latitude || !reading.longitude || !reading.ammonia) return;

        const nh3 = reading.ammonia;
        const center: [number, number] = [reading.latitude, reading.longitude];

        if (nh3 > 20) {
          // Critical Hazard Zone (>20 ppm NH3) -> 400m Red Dispersion Plume
          const redPlume = L.circle(center, {
            radius: 400,
            fillColor: '#ef4444',
            fillOpacity: 0.35,
            color: '#dc2626',
            weight: 2,
            dashArray: '4, 4',
          }).bindPopup(`
            <div style="font-family: sans-serif; padding: 4px;">
              <strong style="color: #dc2626; font-size: 14px;">🚨 Critical Odor Dispersion Zone</strong>
              <div style="margin-top: 4px; font-size: 12px; color: #475569;">
                <b>Ammonia NH₃:</b> ${nh3} ppm<br/>
                <b>Plume Radius:</b> 400 meters<br/>
                <b>Risk:</b> Respiratory Irritation / Immediate Mitigation Required
              </div>
            </div>
          `);
          odorLayerGroup.addLayer(redPlume);
        } else if (nh3 > 10) {
          // High Warning Zone (10-20 ppm NH3) -> 250m Orange Plume
          const orangePlume = L.circle(center, {
            radius: 250,
            fillColor: '#f97316',
            fillOpacity: 0.3,
            color: '#ea580c',
            weight: 2,
          }).bindPopup(`
            <div style="font-family: sans-serif; padding: 4px;">
              <strong style="color: #ea580c; font-size: 14px;">⚠️ High Odor Warning Zone</strong>
              <div style="margin-top: 4px; font-size: 12px; color: #475569;">
                <b>Ammonia NH₃:</b> ${nh3} ppm<br/>
                <b>Plume Radius:</b> 250 meters
              </div>
            </div>
          `);
          odorLayerGroup.addLayer(orangePlume);
        } else if (nh3 > 5) {
          // Moderate Caution Zone (5-10 ppm NH3) -> 150m Yellow Plume
          const yellowPlume = L.circle(center, {
            radius: 150,
            fillColor: '#eab308',
            fillOpacity: 0.25,
            color: '#ca8a04',
            weight: 1.5,
          }).bindPopup(`
            <div style="font-family: sans-serif; padding: 4px;">
              <strong style="color: #ca8a04; font-size: 13px;">⚡ Moderate Odor Caution Zone</strong>
              <div style="margin-top: 4px; font-size: 12px; color: #475569;">
                <b>Ammonia NH₃:</b> ${nh3} ppm<br/>
                <b>Plume Radius:</b> 150 meters
              </div>
            </div>
          `);
          odorLayerGroup.addLayer(yellowPlume);
        }
      });
    }

    return () => {
      map.removeLayer(odorLayerGroup);
    };
  }, [map, readings, sites, showOdorZones]);

  return null;
};

export default OdorZonePolygonLayer;
