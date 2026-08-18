/**
 * BLE Central Service for AmmoniSense
 * Role: CENTRAL ONLY (Scanner & Reader)
 * Service UUID: 0000ffd0-0000-1000-8000-00805f9b34fb
 * Characteristic UUID: 0000ffd1-0000-1000-8000-00805f9b34fb
 * Data Format: 12 bytes (3 x Float32 little-endian)
 *   Bytes 0-3: Ammonia (PPM)
 *   Bytes 4-7: Temperature (°C)
 *   Bytes 8-11: Humidity (%)
 */

import { Geolocation } from '@capacitor/geolocation';

export interface BLEPermissionStatus {
  bluetoothScanGranted: boolean;
  bluetoothConnectGranted: boolean;
  locationGranted: boolean;
  bluetoothEnabled: boolean;
  locationEnabled: boolean;
  canScan: boolean;