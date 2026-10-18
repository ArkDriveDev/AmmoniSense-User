export interface CapturedSessionReading {
  session_id: string;
  inspection_tag_temp_id: string;
  device_uid?: string;
  nh3_ppm: number;
  temperature: number | null;
  humidity: number | null;
  battery_percent: number | null;
  created_at: string;
}

export interface CaptureSummary {
  session_id: string;
  inspection_tag_temp_id: string;
  total_readings: number;
  max_ppm: number;
  avg_ppm: number;
  min_ppm: number;
  readings: CapturedSessionReading[];
}

export type CaptureStatus =
  | 'idle'
  | 'stabilizing'
  | 'ready'
  | 'capturing'
  | 'paused'
  | 'completed'
  | 'stopped';
