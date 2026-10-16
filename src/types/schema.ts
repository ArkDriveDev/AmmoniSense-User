/**
 * AmmoniSense Data Schemas and Types
 */

export interface AmmoniSenseReading {
  /** Temperature in degrees Celsius (°C) */
  temperature: number | null;
  /** Relative humidity percentage (%) */
  humidity: number | null;
  /** Raw MQ-137 ADC input voltage in millivolts (mV) */
  mqPin_mV: number | null;
  /** MQ-137 module analog output voltage in Volts (V) */
  mqAO_V: number | null;
  /** Sensor resistance in kilo-Ohms (kΩ) */
  rs_kOhm: number | null;
  /** Calibrated clean-air resistance in kilo-Ohms (kΩ) */
  r0_kOhm: number | null;
  /** Resistance ratio Rs/R0 */
  ratio: number | null;
  /** Ammonia concentration estimate in parts-per-million (ppm) */
  nh3_ppm: number | null;
  /** Battery charge percentage (%) */
  battery_percent: number | null;
  /** Battery terminal voltage in Volts (V) */
  battery_voltage: number | null;
  /** True if tagged with [PPM UNVERIFIED] marker by firmware */
  ppm_unverified?: boolean;
  /** Raw stream line from ESP32 */
  raw_line?: string;
  /** ISO timestamp when line was received/parsed */
  timestamp: string;
}

export type BluetoothAdapterState = 'on' | 'off' | 'turning_on' | 'turning_off' | 'unsupported' | 'unknown';

export type BluetoothConnectionStatus =
  | 'idle'
  | 'bluetooth_off'
  | 'scanning'
  | 'device_not_found'
  | 'connecting'
  | 'connected'
  | 'failed'
  | 'disconnected';

export interface InspectionSite {
  id: number | string;
  site_code: string;
  site_name: string;
  site_type: string;
  poultry_type?: string | null;
  chicken_type?: string | null;
  current_latitude: number;
  current_longitude: number;
  address: string;
  area_size_hectares: number;
  site_photo_url?: string | null;
  site_photo_thumbnail?: string | null;
  site_photo_storage_path?: string | null;
  site_photo_thumbnail_storage_path?: string | null;
  offline_temp_id?: string | null;
  is_active?: boolean;
  created_at?: string;
  created_by?: string | null;
}

