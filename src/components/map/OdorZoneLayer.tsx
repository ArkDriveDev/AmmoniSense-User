/**
 * OdorZoneLayer — DEPRECATED
 * The odor_zones table has been removed. Inspection tags (inspection_tags) are now
 * the canonical data source for site readings. This component is kept as a no-op stub
 * so that any remaining import references do not break the build.
 */
import React from 'react';
import L from 'leaflet';

export interface OdorZoneLayerProps {
  map?: L.Map | null;
  /** @deprecated No longer used — odor_zones table removed */
  odorZones?: any[];
  /** @deprecated */
  showOdorZones?: boolean;
}

export const OdorZoneLayer: React.FC<OdorZoneLayerProps> = () => null;

export default OdorZoneLayer;
