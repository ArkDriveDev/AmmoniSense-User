/**
 * OdorZonePolygonLayer — DEPRECATED
 * The odor_zones table has been removed from the schema. This component is kept as a
 * no-op stub so that any remaining import references do not break the build.
 */
import React from 'react';
import L from 'leaflet';

interface OdorZonePolygonLayerProps {
  map?: L.Map | null;
  /** @deprecated No longer used — odor_zones table removed */
  odorZones?: any[];
  /** @deprecated */
  showOdorZones?: boolean;
}

export const OdorZonePolygonLayer: React.FC<OdorZonePolygonLayerProps> = () => null;

export default OdorZonePolygonLayer;
