export type GpsSource = 'photo_exif' | 'device_gps' | 'manual';


export interface OfflineSite {
  id: string;                    // temp_id (e.g., 'temp_1234567890')
  isOffline: boolean;            // true for unsynced sites
  isSynced: boolean;            // false until synced
  site_code: string;            // generated locally
  site_name: string;
  site_type: string;
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
  photo_record_id?: number;
  photo_url?: string;
  gps_source?: GpsSource;
  temp_id?: string;
}

// OdorZone removed — replaced by inspection_tags in the new schema

export interface SiteRegistrationResult {
  site: any;
  location: any;
  photo?: any;
}

