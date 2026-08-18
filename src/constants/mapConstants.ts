import L from 'leaflet';

/**
 * Manolo Fortich Municipality Bounding Box Coordinates
 * Southwest: [8.3000, 124.8000]
 * Northeast: [8.4200, 124.9200]
 */
export const MANOLO_FORTICH_BOUNDS: L.LatLngBoundsExpression = [
  [8.3000, 124.8000], // Southwest
  [8.4200, 124.9200], // Northeast
];

/**
 * Default Center & Zoom for Manolo Fortich Municipality
 */
export const MANOLO_FORTICH_CENTER = {
  lat: 8.3600,
  lng: 124.8600,
  zoom: 13,
};

/**
 * Polygon coordinates defining the municipal boundary of Manolo Fortich
 */
export const MANOLO_FORTICH_BOUNDARY: [number, number][] = [
  [8.4200, 124.8400],
  [8.4100, 124.9000],
  [8.3800, 124.9200],
  [8.3400, 124.9100],
  [8.3000, 124.8700],
  [8.3100, 124.8200],
  [8.3500, 124.8000],
  [8.3900, 124.8100],
];

/**
 * Helper to check if a lat/lng coordinate is within Manolo Fortich bounds
 */
export const isInManoloFortich = (lat?: number, lng?: number): boolean => {
  if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) return false;
  return lat >= 8.3000 && lat <= 8.4200 && lng >= 124.8000 && lng <= 124.9200;
};
