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