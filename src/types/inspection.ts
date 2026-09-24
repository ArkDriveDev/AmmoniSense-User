export type AmmoniaStatus = 'NORMAL' | 'WARNING' | 'HIGH' | 'CRITICAL';

export interface AmmoniaThresholdConfig {
  label: AmmoniaStatus;
  min: number;
  max: number;
  color: string;
  badgeClass: string;
}

export const AMMONIA_THRESHOLDS: AmmoniaThresholdConfig[] = [
  { label: 'NORMAL', min: 0, max: 5, color: '#10B981', badgeClass: 'success' },
  { label: 'WARNING', min: 5, max: 10, color: '#F59E0B', badgeClass: 'warning' },
  { label: 'HIGH', min: 10, max: 20, color: '#F97316', badgeClass: 'danger' },
  { label: 'CRITICAL', min: 20, max: Infinity, color: '#EF4444', badgeClass: 'danger' },
];

export function calculateAmmoniaStatus(ppm: number): AmmoniaStatus {
  const value = Number(ppm) || 0;
  if (value <= 5.0) return 'NORMAL';
  if (value <= 10.0) return 'WARNING';
  if (value <= 20.0) return 'HIGH';
  return 'CRITICAL';
}

export function toUpperClean(str?: string | null): string {
  return (str || '').trim().toUpperCase();
}

export type ScheduleStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface InspectionSchedule {
  id: number | string;
  inspection_site_id: number | string;
  schedule_name: string;
  scheduled_date: string;
  scheduled_time: string | null;
  status: ScheduleStatus;
  started_at?: string | null;       // auto-managed by trigger
  completed_at?: string | null;     // auto-managed by trigger
  created_at?: string;
  created_by?: string | null;
  updated_at?: string;
  notes?: string | null;
  offline_temp_id?: string | null;  // required for offline sync
  // UI-only computed fields
  tags_count?: number;
  site_name?: string;
  isOffline?: boolean;
}

export interface CreateSchedulePayload {
  inspection_site_id: number | string;
  schedule_name: string;
  scheduled_date: string;
  scheduled_time: string;
  notes?: string;
  status?: ScheduleStatus;
}

export interface InspectionTag {
  id: number | string;
  tag_name: string;
  ammonia: number;
  temperature: number;
  humidity: number;
  battery: number;
  status: AmmoniaStatus;
  latitude: number;
  longitude: number;
  photo_url?: string | null;
  photo_thumbnail_url?: string | null;
  device_uid?: string | null;
  sensor_data_id?: number | string | null;
  inspection_schedule_id: number | string;
  inspection_site_id?: number | string | null;
  notes?: string | null;
  offline_temp_id?: string | null;
  created_by?: string | null;
  created_at?: string;
  isOffline?: boolean;
}

export interface CreateTagPayload {
  tag_name: string;
  ammonia: number;
  temperature?: number;
  humidity?: number;
  battery?: number;
  latitude: number;
  longitude: number;
  photo_url?: string | null;
  photo_thumbnail_url?: string | null;
  device_uid?: string | null;
  sensor_data_id?: number | string | null;
  inspection_schedule_id: number | string;
  inspection_site_id?: number | string | null;
  notes?: string;
  offline_temp_id?: string | null;
  status?: AmmoniaStatus;
}
