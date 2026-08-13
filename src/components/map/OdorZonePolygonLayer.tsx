import React, { useEffect } from 'react';
import L from 'leaflet';
import { ReadingMarkerData, SiteMarkerData } from './FullMapView';

export interface CommunityPolygonData {
  id: string;
  name: string;
  type: 'Residential' | 'School' | 'Hospital' | 'Commercial';
  population: number;
  center: [number, number];
  boundary: [number, number][];
}

// Preset Vulnerable Communities in Manolo Fortich, Bukidnon
export const MANOLO_FORTICH_COMMUNITIES: CommunityPolygonData[] = [
  {
    id: 'comm-tankulan',
    name: 'Poblacion Tankulan Residential Zone',
    type: 'Residential',
    population: 14200,
    center: [8.3683, 124.8637],
    boundary: [
      [8.3750, 124.8580],
      [8.3760, 124.8700],
      [8.3620, 124.8720],
      [8.3600, 124.8590],
    ],
  },
  {
    id: 'comm-lunocan',
    name: 'Lunocan Community & Elementary School Zone',
    type: 'School',
    population: 6800,
    center: [8.3450, 124.8300],
    boundary: [
      [8.3510, 124.8220],
      [8.3520, 124.8380],
      [8.3390, 124.8360],
      [8.3380, 124.8240],
    ],
  },
  {
    id: 'comm-dicklum',
    name: 'Dicklum Agricultural & Residential Area',
    type: 'Residential',
    population: 4500,
    center: [8.3900, 124.8900],
    boundary: [
      [8.3970, 124.8820],
      [8.3980, 124.8980],
      [8.3830, 124.8950],
      [8.3820, 124.8810],
    ],
  },
  {
    id: 'comm-agusan',
    name: 'Agusan Canyon Health & Living District',
    type: 'Hospital',
    population: 8900,
    center: [8.4120, 124.8250],
    boundary: [
      [8.4190, 124.8180],
      [8.4200, 124.8320],
      [8.4060, 124.8300],
      [8.4050, 124.8170],
    ],
  },
];

interface OdorZonePolygonLayerProps {
  map: L.Map | null;
  readings?: ReadingMarkerData[];
  sites?: SiteMarkerData[];
  showOdorZones?: boolean;
  showCommunities?: boolean;
}

export const OdorZonePolygonLayer: React.FC<OdorZonePolygonLayerProps> = ({
  map,
  readings = [],
  sites = [],
  showOdorZones = true,
  showCommunities = true,
}) => {
  useEffect(() => {
    if (!map) return;

    const odorLayerGroup = L.layerGroup().addTo(map);
    const communityLayerGroup = L.layerGroup().addTo(map);

    // 1. Render Odor Dispersion Circles / Polygons
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

    // 2. Render Vulnerable Community Boundaries
    if (showCommunities) {
      MANOLO_FORTICH_COMMUNITIES.forEach((comm) => {
        const poly = L.polygon(comm.boundary, {
          color: '#3b82f6',
          weight: 2,
          dashArray: '6, 6',
          fillColor: '#60a5fa',
          fillOpacity: 0.15,
        });

        const iconEmoji = comm.type === 'School' ? '🏫' : comm.type === 'Hospital' ? '🏥' : '🏡';

        const labelMarker = L.marker(comm.center, {
          icon: L.divIcon({
            className: 'community-label-marker',
            html: `
              <div style="
                background: rgba(15, 23, 42, 0.88);
                color: #f8fafc;
                padding: 3px 8px;
                border-radius: 12px;
                font-size: 10px;
                font-weight: 700;
                border: 1px solid rgba(255,255,255,0.2);
                white-space: nowrap;
                box-shadow: 0 2px 6px rgba(0,0,0,0.3);
              ">
                ${iconEmoji} ${comm.name} (${comm.population.toLocaleString()} pop)
              </div>
            `,
            iconSize: [160, 20],
            iconAnchor: [80, 10],
          }),
        });

        poly.bindPopup(`
          <div style="font-family: sans-serif; padding: 4px;">
            <strong style="color: #1e40af; font-size: 14px;">${iconEmoji} ${comm.name}</strong>
            <div style="margin-top: 4px; font-size: 12px; color: #475569;">
              <b>Type:</b> ${comm.type} Zone<br/>
              <b>Estimated Population:</b> ${comm.population.toLocaleString()} Residents<br/>
              <b>Municipality:</b> Manolo Fortich, Bukidnon
            </div>
          </div>
        `);

        communityLayerGroup.addLayer(poly);
        communityLayerGroup.addLayer(labelMarker);
      });
    }

    return () => {
      map.removeLayer(odorLayerGroup);
      map.removeLayer(communityLayerGroup);
    };
  }, [map, readings, sites, showOdorZones, showCommunities]);

  return null;
};

export default OdorZonePolygonLayer;
