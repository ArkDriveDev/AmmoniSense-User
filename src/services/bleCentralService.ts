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
  errorMsg?: string;
}

export interface BLECentralDevice {
  id: string;
  name: string;
  rssi?: number;
  connected?: boolean;
}

export interface BLECentralReading {
  device_id: string;
  device_name: string;
  ammonia_ppm: number;
  temperature_c: number;
  humidity_pct: number;
  battery_pct?: number;
  rssi?: number;
  timestamp: string;
}

export type BLECentralState = 'disconnected' | 'scanning' | 'connecting' | 'connected' | 'subscribing' | 'streaming';

export type BLECentralTelemetryListener = (reading: BLECentralReading) => void;
export type BLECentralDeviceListener = (devices: BLECentralDevice[]) => void;
export type BLECentralStateListener = (state: BLECentralState) => void;

class BLECentralService {
  public static SERVICE_UUID = '0000ffd0-0000-1000-8000-00805f9b34fb';
  public static CHARACTERISTIC_UUID = '0000ffd1-0000-1000-8000-00805f9b34fb';
  public static BROADCAST_CHANNEL_NAME = 'ammonisense_ble_central_stream';

  private currentState: BLECentralState = 'disconnected';
  private discoveredDevices: BLECentralDevice[] = [];
  private activeDevice: BLECentralDevice | null = null;

  private telemetryListeners: BLECentralTelemetryListener[] = [];
  private deviceListeners: BLECentralDeviceListener[] = [];
  private stateListeners: BLECentralStateListener[] = [];

  private gattServer: any = null;
  private bluetoothDevice: any = null;
  private broadcastChannel: BroadcastChannel | null = null;

  constructor() {
    this.initBroadcastChannel();
  }

  private initBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.broadcastChannel = new BroadcastChannel(BLECentralService.BROADCAST_CHANNEL_NAME);
      this.broadcastChannel.onmessage = (event) => {
        if (event.data && event.data.type === 'BLE_CENTRAL_TELEMETRY') {
          const reading: BLECentralReading = event.data.payload;
          this.setState('streaming');
          this.notifyTelemetryListeners(reading);
        }
      };
    }
  }