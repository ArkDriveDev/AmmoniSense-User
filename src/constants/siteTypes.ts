export const SITE_TYPES = [
  { value: 'POULTRY', label: 'Poultry' },
];

export const POULTRY_TYPES = [
  { value: 'CONVENTIONAL', label: 'Conventional' },
  { value: 'RETROFITTED', label: 'Retrofitted' },
  { value: 'TUNNEL VENT', label: 'Tunnel Vent' },
];

export const CHICKEN_TYPES = [
  { value: 'LAYER', label: 'Layer' },
  { value: 'BROILER', label: 'Broiler' },
  { value: 'BREEDER', label: 'Breeder' },
  { value: 'GRAND PARENTS/GP', label: 'Grand Parents / GP' },
];

export function getSiteTypeLabel(v: string | null | undefined): string {
  const match = SITE_TYPES.find((t) => t.value === v?.toUpperCase());
  return match ? match.label : (v || 'Poultry');
}

export function getPoultryTypeLabel(v: string | null | undefined): string {
  const match = POULTRY_TYPES.find((t) => t.value === v?.toUpperCase());
  return match ? match.label : (v || '—');
}

export function getChickenTypeLabel(v: string | null | undefined): string {
  const match = CHICKEN_TYPES.find((t) => t.value === v?.toUpperCase());
  return match ? match.label : (v || '—');
}
