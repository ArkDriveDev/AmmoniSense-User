export type GpsSource = 'photo_exif' | 'device_gps' | 'manual';

export interface CreateSitePayload {
  site_code: string;
  site_name: string;
  site_type: string;
  address?: string;
  area_size_hectares: number;
  latitude: number;
  longitude: number;
  grid_cell_id: string;
  notes?: string;
  owner_name?: string;
  owner_email?: string;
  photo_record_id?: number;
  photo_url?: string;
  gps_source?: GpsSource;
}

export interface SiteRegistrationResult {
  owner: any;
  site: any;
  location: any;
  photo?: any;
}
