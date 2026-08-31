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

import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { BluetoothLowEnergy } from '@capgo/capacitor-bluetooth-low-energy';

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
    this.initNativeBLE();
  }

  private initNativeBLE() {
    if (Capacitor.isNativePlatform()) {
      try {
        BluetoothLowEnergy.shimWebBluetooth();
        BluetoothLowEnergy.initialize({ mode: 'central' }).catch((err) => {
          console.warn('BLE central init notice:', err);
        });
      } catch (e) {
        console.warn('Failed to shim Web Bluetooth:', e);
      }
    }
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
   * Phase 1: Initialize BLE & check availability/permissions
   */
  public async phase1_Initialize(): Promise<{ available: boolean; enabled: boolean; errorMsg?: string }> {
    if (Capacitor.isNativePlatform()) {
      this.initNativeBLE();
      try {
        const isAvail = await BluetoothLowEnergy.isAvailable();
        if (!isAvail.available) {
          return { available: false, enabled: false, errorMsg: 'Bluetooth Low Energy hardware not available on this device.' };
        }

        const isEn = await BluetoothLowEnergy.isEnabled();
        if (!isEn.enabled) {
          return { available: true, enabled: false, errorMsg: 'Bluetooth is turned off. Please turn on Bluetooth on your device.' };
        }

        const blePerm = await BluetoothLowEnergy.requestPermissions();
        if (blePerm.bluetooth !== 'granted') {
          return { available: true, enabled: true, errorMsg: 'Nearby Devices (Bluetooth) permission was denied.' };
        }

        return { available: true, enabled: true };
      } catch (err: any) {
        return { available: false, enabled: false, errorMsg: err?.message || 'BLE Init error' };
      }
    }

    const nav = navigator as any;
    if (!nav.bluetooth) {
      return { available: false, enabled: false, errorMsg: 'Web Bluetooth API is not supported in this browser environment.' };
    }
    return { available: true, enabled: true };
  }

  /**
   * Phase 2: Check & Request Location Permissions for Scanning
   */
  public async phase2_CheckScanRequirements(): Promise<BLEPermissionStatus> {
    const initRes = await this.phase1_Initialize();
    const status: BLEPermissionStatus = {
      bluetoothScanGranted: initRes.available && !initRes.errorMsg,
      bluetoothConnectGranted: initRes.available && !initRes.errorMsg,
      locationGranted: true,
      bluetoothEnabled: initRes.enabled,
      locationEnabled: true,
      canScan: initRes.available && initRes.enabled && !initRes.errorMsg,
      errorMsg: initRes.errorMsg,
    };

    if (!status.canScan) return status;

    // Check & request Location
    try {
      const geoStatus = await Geolocation.checkPermissions();
      if (geoStatus.location !== 'granted') {
        const requested = await Geolocation.requestPermissions();
        if (requested.location !== 'granted') {
          status.locationGranted = false;
          status.canScan = false;
          status.errorMsg = 'Location permission is required for Bluetooth scanning on Android.';
        }
      }
    } catch (geoErr) {
      console.warn('Geolocation check notice:', geoErr);
    }

    return status;
  }

  /**
   * Auto-request ALL permissions required for BLE scanning:
   */
  public async checkAndRequestPermissions(): Promise<BLEPermissionStatus> {
    return this.phase2_CheckScanRequirements();
  }

  /**
   * Open Android App Settings prompt for missing permissions
   */
  public async openSettings(): Promise<void> {
    if (Capacitor.isNativePlatform()) {
      try {
        await BluetoothLowEnergy.openAppSettings();
        return;
      } catch (err) {
        console.warn('openAppSettings error:', err);
      }
    }

    if (typeof window !== 'undefined') {
      alert(
        '⚠️ BLE & Location Permissions Required\n\n' +
          'To scan for nearby BLE sensor nodes:\n' +
          '1. Open device Settings > Apps > AmmoniSense.\n' +
          '2. Tap Permissions.\n' +
          '3. Enable Nearby Devices (Bluetooth) & Location (Fine Location).'
      );
    }
  }

  /**
   * Phase 2 (Execution): Scan for actual hardware BLE devices
   */
  public async scanForDevices(): Promise<BLECentralDevice[]> {
    const permStatus = await this.phase2_CheckScanRequirements();
    if (!permStatus.canScan) {
      console.warn('BLE scan prevented by permission/hardware check:', permStatus.errorMsg);
      this.setState('disconnected');
      throw new Error(permStatus.errorMsg || 'BLE permissions or hardware disabled.');
    }

    if (Capacitor.isNativePlatform()) {
      try {
        BluetoothLowEnergy.shimWebBluetooth();
      } catch (e) {
        console.warn('Failed to ensure shimWebBluetooth:', e);
      }
    }

    const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
    const bt = nav?.bluetooth;

    if (!bt || typeof bt.requestDevice !== 'function') {
      this.setState('disconnected');
      throw new Error('Bluetooth is not supported or initialized on this device. Please grant Bluetooth permissions.');
    }

    this.setState('scanning');

    try {
      let device: any;
      try {
        device = await bt.requestDevice({
          filters: [
            { services: [BLECentralService.SERVICE_UUID] },
            { namePrefix: 'ESP32' },
            { namePrefix: 'AmmoniSense' },
            { namePrefix: 'Ammonia' },
            { namePrefix: 'Sensor' },
            { namePrefix: 'Node' },
            { namePrefix: 'BLE' },
          ],
          optionalServices: [
            BLECentralService.SERVICE_UUID,
            '0000181a-0000-1000-8000-00805f9b34fb',
            'generic_access',
          ],
        });
      } catch (filterErr: any) {
        if (filterErr.name === 'NotFoundError' || filterErr.message?.includes('cancelled') || filterErr.message?.includes('User cancelled')) {
          throw filterErr;
        }
        device = await bt.requestDevice({
          acceptAllDevices: true,
          optionalServices: [
            BLECentralService.SERVICE_UUID,
            '0000181a-0000-1000-8000-00805f9b34fb',
            'generic_access',
          ],
        });
      }

      const centralDevice: BLECentralDevice = {
        id: device.id || `BLE-${Math.floor(1000 + Math.random() * 9000)}`,
        name: device.name || 'ESP32 Ammonia Node',
        rssi: -60,
        connected: false,
      };

      this.bluetoothDevice = device;
      this.discoveredDevices = [centralDevice];
      this.notifyDeviceListeners(this.discoveredDevices);
      this.setState('disconnected');
      return this.discoveredDevices;
    } catch (err: any) {
      console.warn('BLE Central hardware scan cancelled or failed:', err);
      this.setState('disconnected');
      throw err;
    }
  }

  /**
   * Phase 3 (Connect) & Phase 4 (Data Transfer): Connect and subscribe to telemetry notifications
   */
  public async connectAndSubscribe(device: BLECentralDevice): Promise<void> {
    // Phase 3: Verify permissions prior to GATT connect
    const verifyPerms = await this.phase1_Initialize();
    if (!verifyPerms.enabled || verifyPerms.errorMsg) {
      throw new Error(verifyPerms.errorMsg || 'Bluetooth permission or hardware not ready.');
    }

    this.activeDevice = device;
    this.setState('connecting');

    if (this.bluetoothDevice && this.bluetoothDevice.id === device.id) {
      try {
        const server = await this.bluetoothDevice.gatt.connect();
        this.gattServer = server;
        this.setState('subscribing');

        // Phase 4: Data Transfer & Notifications
        const service = await server.getPrimaryService(BLECentralService.SERVICE_UUID);
        const characteristic = await service.getCharacteristic(BLECentralService.CHARACTERISTIC_UUID);

        await characteristic.startNotifications();
        this.setState('streaming');
        device.connected = true;

        characteristic.addEventListener('characteristicvaluechanged', (event: any) => {
          const value: DataView = event.target.value;
          const reading = this.parse12ByteFloat32DataView(value, device.id, device.name, device.rssi);
          if (reading) {
            this.notifyTelemetryListeners(reading);
            this.broadcastTelemetry(reading);
          }
        });
        return;
      } catch (gattErr) {
        console.error('Actual GATT hardware connection failed:', gattErr);
        this.setState('disconnected');
        throw gattErr;
      }
    } else {
      this.setState('disconnected');
      throw new Error('Device not paired or Web Bluetooth instance missing.');
    }
  }

  /**
   * Broadcast telemetry data to all tabs/windows via BroadcastChannel
   */
  public broadcastTelemetry(reading: BLECentralReading) {
    if (this.broadcastChannel) {
      this.broadcastChannel.postMessage({
        type: 'BLE_CENTRAL_TELEMETRY',
        payload: reading,
      });
    }
  }

  public disconnect() {
    if (this.gattServer && this.gattServer.connected) {
      this.gattServer.disconnect();
    }
    if (this.activeDevice) {
      this.activeDevice.connected = false;
    }
    this.activeDevice = null;
    this.gattServer = null;
    this.bluetoothDevice = null;
    this.setState('disconnected');
  }
}

export const bleCentralService = new BLECentralService();
export default bleCentralService;
