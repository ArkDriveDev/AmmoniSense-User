import { ViolationCategory } from '../types/inspection';

export interface ViolationCategoryOption {
  value: ViolationCategory;
  label: string;
  lawReference: string;
  badgeColor: string;
}

export const VIOLATION_CATEGORIES: ViolationCategoryOption[] = [
  { value: 'IMPROPER_WASTE_DISPOSAL', label: 'Improper Waste Disposal', lawReference: 'RA 9003', badgeColor: 'warning' },
  { value: 'ILLEGAL_DUMPING', label: 'Illegal Dumping', lawReference: 'RA 9003', badgeColor: 'danger' },
  { value: 'OPEN_BURNING', label: 'Open Burning', lawReference: 'RA 8749', badgeColor: 'danger' },
  { value: 'FOUL_ODOR', label: 'Foul Odor', lawReference: 'Ord. 2025-2206', badgeColor: 'warning' },
  { value: 'STAGNANT_WATER', label: 'Stagnant Water', lawReference: 'Ord. 2025-2206', badgeColor: 'secondary' },
  { value: 'WATER_POLLUTION', label: 'Water Pollution', lawReference: 'RA 9275', badgeColor: 'danger' },
  { value: 'MANURE_PILING', label: 'Manure Piling', lawReference: 'Ord. 2025-2206', badgeColor: 'warning' },
  { value: 'NOISE', label: 'Noise Pollution', lawReference: 'Ord. 2025-2206', badgeColor: 'tertiary' },
  { value: 'WASTEWATER_DISCHARGE', label: 'Wastewater Discharge', lawReference: 'RA 9275', badgeColor: 'danger' },
  { value: 'NO_PERMIT', label: 'No Permit / Non-Compliant', lawReference: 'MENRO', badgeColor: 'medium' },
  { value: 'OTHERS', label: 'Others (Specify in Notes)', lawReference: 'General', badgeColor: 'dark' },
];

const VIOLATION_CATEGORY_MAP = new Map<ViolationCategory, ViolationCategoryOption>(
  VIOLATION_CATEGORIES.map((cat) => [cat.value, cat])
);

export function getViolationCategoryLabel(value?: ViolationCategory | string | null): string {
  if (!value) return '';
  return VIOLATION_CATEGORY_MAP.get(value as ViolationCategory)?.label || value;
}

export function getViolationCategoryBadgeColor(value?: ViolationCategory | string | null): string {
  if (!value) return 'medium';
  return VIOLATION_CATEGORY_MAP.get(value as ViolationCategory)?.badgeColor || 'medium';
}
