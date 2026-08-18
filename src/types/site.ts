export type GpsSource = 'photo_exif' | 'device_gps' | 'manual';

export interface OfflineOwner {
  owner_name: string;
  contact_number?: string;
  email?: string;
  address?: string;
}

export interface OfflineSite {
  id: string;                    // temp_id (e.g., 'temp_1234567890')
  isOffline: boolean;            // true for unsynced sites
  isSynced: boolean;            // false until synced
  site_code: string;            // generated locally
  site_name: string;
  site_type: string;
  owner_id: number | null;      // null until synced
  owner?: OfflineOwner;          // offline owner data
  current_latitude: number;
  current_longitude: number;
  address: string;
  area_size_hectares: number;
  site_photo_url?: string;       // base64 or local path
  site_photo_thumbnail?: string;
  created_at: string;
  created_by?: string;           // user ID
  notes?: string;
  syncStatus: 'pending' | 'syncing' | 'failed' | 'synced';
  retryCount: number;
  lastModified: string;
  isDeleted?: boolean;
}

export interface CreateSitePayload {
  site_code: string;
  site_name: string;
  site_type: string;
  address?: string;
  area_size_hectares: number;
  latitude: number;
  longitude: number;
  notes?: string;
  owner_name?: string;
  owner_email?: string;
  photo_record_id?: number;
  photo_url?: string;
  gps_source?: GpsSource;
  temp_id?: string;
}

export interface OdorZone {
  id?: number | string;
  site_id?: number | null;
  zone_name: string;
  severity_level: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  ammonia_ppm: number;
  coordinates: [number, number][]; // Array of [lat, lng] vertices
  created_at?: string;
  created_by?: string;
  is_pending_sync?: boolean;
}

export interface CommunityPolygon {
  id?: number | string;
  community_name: string;
  community_type: 'Residential' | 'School' | 'Hospital' | 'Commercial' | 'Agricultural';
  estimated_population: number;
  coordinates: [number, number][]; // Array of [lat, lng] boundary vertices
  created_at?: string;
  created_by?: string;
  is_pending_sync?: boolean;
}

export interface SiteRegistrationResult {
  owner: any;
  site: any;
  location: any;
  photo?: any;
}
