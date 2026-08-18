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

  public getState(): BLECentralState {
    return this.currentState;
  }

  public getActiveDevice(): BLECentralDevice | null {
    return this.activeDevice;
  }

  public getDiscoveredDevices(): BLECentralDevice[] {
    return this.discoveredDevices;
  }

  public setState(state: BLECentralState) {
    this.currentState = state;
    this.stateListeners.forEach((fn) => fn(state));
  }

  public onTelemetry(listener: BLECentralTelemetryListener): () => void {
    this.telemetryListeners.push(listener);
    return () => {
      this.telemetryListeners = this.telemetryListeners.filter((l) => l !== listener);
    };
  }

  public onDevicesDiscovered(listener: BLECentralDeviceListener): () => void {
    this.deviceListeners.push(listener);
    return () => {
      this.deviceListeners = this.deviceListeners.filter((l) => l !== listener);
    };
  }

  public onStateChange(listener: BLECentralStateListener): () => void {
    this.stateListeners.push(listener);
    return () => {
      this.stateListeners = this.stateListeners.filter((l) => l !== listener);
    };
  }

  private notifyTelemetryListeners(reading: BLECentralReading) {
    this.telemetryListeners.forEach((fn) => fn(reading));
  }

  private notifyDeviceListeners(devices: BLECentralDevice[]) {
    this.deviceListeners.forEach((fn) => fn(devices));
  }

  /**
   * Parse 12-byte Float32 Little-Endian DataView binary payload from actual GATT notification
   * Bytes 0-3: Ammonia Float32
   * Bytes 4-7: Temp Float32
   * Bytes 8-11: Humidity Float32
   */
  public parse12ByteFloat32DataView(dataView: DataView, deviceId: string, deviceName: string, rssi?: number): BLECentralReading | null {
    try {
      if (dataView.byteLength < 12) {
        console.warn(`BLE DataView buffer length (${dataView.byteLength} bytes) is less than expected 12 bytes.`);
        return null;
      }

      // Read IEEE 754 Float32 values in little-endian byte order
      const ammonia = dataView.getFloat32(0, true);
      const temperature = dataView.getFloat32(4, true);
      const humidity = dataView.getFloat32(8, true);

      return {
        device_id: deviceId,
        device_name: deviceName,
        ammonia_ppm: parseFloat(ammonia.toFixed(2)),
        temperature_c: parseFloat(temperature.toFixed(1)),
        humidity_pct: parseFloat(humidity.toFixed(1)),
        battery_pct: 100,
        rssi: rssi || -60,
        timestamp: new Date().toISOString(),
      };
    } catch (err) {
      console.error('Failed to parse 12-byte Float32 DataView:', err);
      return null;
    }
  }

  /**
   * Auto-request ALL permissions required for BLE scanning:
   * - BLE permissions (BLUETOOTH_SCAN, BLUETOOTH_CONNECT)
   * - Location permissions (ACCESS_FINE_LOCATION)
   * - Check if Bluetooth & Location services are enabled
   */
  public async checkAndRequestPermissions(): Promise<BLEPermissionStatus> {
    const status: BLEPermissionStatus = {
      bluetoothScanGranted: true,
      bluetoothConnectGranted: true,
      locationGranted: true,
      bluetoothEnabled: true,
      locationEnabled: true,
      canScan: true,