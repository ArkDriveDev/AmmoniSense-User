import {
  eggOutline,
  pawOutline,
  leafOutline,
  businessOutline,
  waterOutline,
  pricetagOutline
} from 'ionicons/icons';

export interface SiteTypeMeta {
  icon: string;
  label: string;
  badgeBg: string;
  badgeColor: string;
  borderColor: string;
}

export function getSiteTypeMeta(siteType?: string): SiteTypeMeta {
  const norm = (siteType || '').trim().toLowerCase();

  if (norm.includes('poultry')) {
    return {
      icon: eggOutline,
      label: 'Poultry Farm',
      badgeBg: '#FEF3C7',
      badgeColor: '#B45309',
      borderColor: '#FDE68A',
    };
  }

  if (norm.includes('piggery') || norm.includes('pig') || norm.includes('swine')) {
    return {
      icon: pawOutline,
      label: 'Piggery Farm',
      badgeBg: '#FCE7F3',
      badgeColor: '#BE185D',
      borderColor: '#FBCFE8',
    };
  }

  if (norm.includes('agri') || norm.includes('crop') || norm.includes('farm')) {
    return {
      icon: leafOutline,
      label: 'Agricultural Zone',
      badgeBg: '#D1FAE5',
      badgeColor: '#047857',
      borderColor: '#A7F3D0',
    };
  }

  if (norm.includes('indus') || norm.includes('factory') || norm.includes('facility')) {
    return {
      icon: businessOutline,
      label: 'Industrial Facility',
      badgeBg: '#EEF2FF',
      badgeColor: '#4338CA',
      borderColor: '#C7D2FE',
    };
  }

  if (norm.includes('river') || norm.includes('water')) {
    return {
      icon: waterOutline,
      label: 'River / Waterway',
      badgeBg: '#E0F2FE',
      badgeColor: '#0369A1',
      borderColor: '#BAE6FD',
    };
  }

  return {
    icon: pricetagOutline,
    label: siteType || 'Inspection Site',
    badgeBg: '#EBF3FA',
    badgeColor: '#1D5D9B',
    borderColor: '#BFDBFE',
  };
}

export interface SiteMapPinMeta {
  emoji: string;
  pinColor: string;
  fillColor: string;
  label: string;
}

export function getSiteMapPinMeta(siteType?: string): SiteMapPinMeta {
  const norm = (siteType || '').trim().toLowerCase();

  if (norm.includes('poultry')) {
    return {
      emoji: '🐔',
      pinColor: '#D97706',
      fillColor: '#FEF3C7',
      label: 'Poultry Farm',
    };
  }

  if (norm.includes('piggery') || norm.includes('pig') || norm.includes('swine')) {
    return {
      emoji: '🐷',
      pinColor: '#DB2777',
      fillColor: '#FCE7F3',
      label: 'Piggery Farm',
    };
  }

  if (norm.includes('agri') || norm.includes('crop') || norm.includes('farm')) {
    return {
      emoji: '🌱',
      pinColor: '#059669',
      fillColor: '#D1FAE5',
      label: 'Agricultural Zone',
    };
  }

  if (norm.includes('indus') || norm.includes('factory') || norm.includes('facility')) {
    return {
      emoji: '🏭',
      pinColor: '#4F46E5',
      fillColor: '#EEF2FF',
      label: 'Industrial Facility',
    };
  }

  if (norm.includes('river') || norm.includes('water')) {
    return {
      emoji: '💧',
      pinColor: '#0284C7',
      fillColor: '#E0F2FE',
      label: 'River / Waterway',
    };
  }

  return {
    emoji: '🏢',
    pinColor: '#1D5D9B',
    fillColor: '#EBF3FA',
    label: siteType || 'Inspection Site',
  };
}

