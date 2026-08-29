import * as turf from '@turf/turf';
import type { Feature, Polygon, MultiPolygon } from 'geojson';
import { OdorZone } from '../types/site';

/**
 * Convert an array of Leaflet [latitude, longitude] pairs into a standard GeoJSON Polygon geometry.
 * GeoJSON requires coordinates in [longitude, latitude] format, with the ring closed (first == last point).
 */
export function toGeoJSONPolygon(latLngs: [number, number][]): Polygon {
  if (!latLngs || latLngs.length < 3) {
    throw new Error('A polygon requires at least 3 points.');
  }

  const ring: [number, number][] = latLngs.map(([lat, lng]) => [lng, lat]);

  // Ensure linear ring is closed
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }

  return {
    type: 'Polygon',
    coordinates: [ring],
  };
}

/**
 * Extract Leaflet [latitude, longitude] coordinates array from a GeoJSON Polygon geometry or feature.
 */
export function fromGeoJSONPolygon(geojson: any): [number, number][] {
  if (!geojson) return [];

  let coordinates: any[] = [];
  if (geojson.type === 'Polygon' && Array.isArray(geojson.coordinates)) {
    coordinates = geojson.coordinates[0] || [];
  } else if (geojson.type === 'Feature' && geojson.geometry?.type === 'Polygon') {
    coordinates = geojson.geometry.coordinates[0] || [];
  } else if (Array.isArray(geojson)) {
    // If already array of coords
    return geojson;
  }

  return coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);
}

/**
 * Check if a given latitude/longitude point is inside a GeoJSON polygon using Turf.js.
 */
export function isPointInPolygon(lat: number, lng: number, polygonGeoJson: any): boolean {
  if (!lat || !lng || !polygonGeoJson) return false;

  try {
    const pt = turf.point([lng, lat]);
    let polyFeature: any;

    if (polygonGeoJson.type === 'Feature') {
      polyFeature = polygonGeoJson;
    } else if (polygonGeoJson.type === 'Polygon' || polygonGeoJson.type === 'MultiPolygon') {
      polyFeature = turf.feature(polygonGeoJson);
    } else if (Array.isArray(polygonGeoJson) && polygonGeoJson.length >= 3) {
      const geojson = toGeoJSONPolygon(polygonGeoJson);
      polyFeature = turf.polygon(geojson.coordinates);
    } else {
      return false;
    }

    return turf.booleanPointInPolygon(pt, polyFeature);
  } catch (err) {
    console.warn('Error during Turf point-in-polygon check:', err);
    return false;
  }
}

/**
 * Find the matching OdorZone (if any) containing the given GPS point.
 */
export function findOdorZoneForPoint(
  lat: number,
  lng: number,
  zones: OdorZone[]
): OdorZone | null {
  if (!zones || zones.length === 0) return null;

  for (const zone of zones) {
    const geojson = zone.polygon_geojson || (zone.coordinates ? toGeoJSONPolygon(zone.coordinates) : null);
    if (geojson && isPointInPolygon(lat, lng, geojson)) {
      return zone;
    }
  }

  return null;
}

/**
 * Calculate polygon area in hectares using Turf.js.
 */
export function calculatePolygonAreaHectares(polygonGeoJson: any): number {
  try {
    let polyFeature: any;
    if (polygonGeoJson.type === 'Feature') {
      polyFeature = polygonGeoJson;
    } else if (polygonGeoJson.type === 'Polygon') {
      polyFeature = turf.polygon(polygonGeoJson.coordinates);
    } else if (Array.isArray(polygonGeoJson)) {
      const geojson = toGeoJSONPolygon(polygonGeoJson);
      polyFeature = turf.polygon(geojson.coordinates);
    } else {
      return 0;
    }

    const areaSqMeters = turf.area(polyFeature);
    const hectares = areaSqMeters / 10000;
    return parseFloat(hectares.toFixed(2));
  } catch (err) {
    console.warn('Error calculating polygon area:', err);
    return 0;
  }
}

/**
 * Calculate center/centroid [latitude, longitude] of a GeoJSON polygon.
 */
export function calculatePolygonCenter(polygonGeoJson: any): { lat: number; lng: number } | null {
  try {
    let polyFeature: any;
    if (polygonGeoJson.type === 'Feature') {
      polyFeature = polygonGeoJson;
    } else if (polygonGeoJson.type === 'Polygon') {
      polyFeature = turf.polygon(polygonGeoJson.coordinates);
    } else if (Array.isArray(polygonGeoJson)) {
      const geojson = toGeoJSONPolygon(polygonGeoJson);
      polyFeature = turf.polygon(geojson.coordinates);
    } else {
      return null;
    }

    const centerPoint = turf.center(polyFeature);
    const [lng, lat] = centerPoint.geometry.coordinates;
    return { lat, lng };
  } catch (err) {
    console.warn('Error calculating polygon center:', err);
    return null;
  }
}
