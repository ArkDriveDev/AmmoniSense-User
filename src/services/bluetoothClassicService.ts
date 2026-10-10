import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { AmmoniSenseReading, BluetoothConnectionStatus } from '../types/schema';
import { parseAmmoniSenseLine, SerialStreamBuffer } from '../utils/serialParser';

export interface BluetoothDevice {
  id: string;
  name: string;
  address?: string;
  class?: number;
}

export type ReadingListener = (reading: AmmoniSenseReading) => void;
export type StatusListener = (status: BluetoothConnectionStatus, message?: string) => void;

declare global {
  interface Window {
    bluetoothSerial?: {
      isEnabled: (success: () => void, failure: (err: any) => void) => void;
      enable: (success: () => void, failure: (err: any) => void) => void;
      list: (success: (devices: any[]) => void, failure: (err: any) => void) => void;
      discoverUnpaired: (success: (devices: any[]) => void, failure: (err: any) => void) => void;
      connect: (address: string, success: () => void, failure: (err: any) => void) => void;
      connectInsecure: (address: string, success: () => void, failure: (err: any) => void) => void;
      disconnect: (success: () => void, failure: (err: any) => void) => void;
      isConnected: (success: () => void, failure: (err: any) => void) => void;
      subscribe: (delimiter: string, success: (data: string) => void, failure: (err: any) => void) => void;
      subscribeRawData: (success: (data: ArrayBuffer) => void, failure: (err: any) => void) => void;
      unsubscribe: (success: () => void, failure: (err: any) => void) => void;
      clear: (success: () => void, failure: (err: any) => void) => void;
      showBluetoothSettings?: (success: () => void, failure: (err: any) => void) => void;
    };
  }
}

class BluetoothClassicService {
  public static readonly TARGET_DEVICE_NAME = 'AmmoniSense';
  public static readonly CONNECT_TIMEOUT_MS = 12000; // 12-second connect timeout
  public static readonly BROADCAST_CHANNEL = 'ammonisense_classic_spp_stream';

  private status: BluetoothConnectionStatus = 'idle';
  private statusMessage = '';
  private isConnecting = false;
  private connectedDevice: BluetoothDevice | null = null;
  private latestReading: AmmoniSenseReading | null = null;

  private streamBuffer = new SerialStreamBuffer();
  private readingListeners: ReadingListener[] = [];
  private statusListeners: StatusListener[] = [];
  private broadcastChannel: BroadcastChannel | null = null;
  private connectTimeoutTimer: any = null;

  constructor() {
    this.initBroadcastChannel();
    this.initAppResumeListener();
  }

  private initBroadcastChannel() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.broadcastChannel = new BroadcastChannel(BluetoothClassicService.BROADCAST_CHANNEL);
      this.broadcastChannel.onmessage = (event) => {
        if (event.data?.type === 'CLASSIC_SPP_READING' && event.data.payload) {
          const reading: AmmoniSenseReading = event.data.payload;
          this.latestReading = reading;
          this.notifyReadingListeners(reading);
        }
      };
    }
  }

  /**
   * Automatically re-check live Bluetooth state when the app resumes from background.
   */
  private initAppResumeListener() {
    try {
      if (Capacitor.isNativePlatform()) {
        App.addListener('appStateChange', async (state) => {
          if (state.isActive) {
            await this.checkLiveStateAndNotify();
          }
        }).catch(() => {});
      } else if (typeof window !== 'undefined') {
        window.addEventListener('focus', () => {
          this.checkLiveStateAndNotify();
        });
      }
    } catch {
      // Browser or testing environment fallback
      if (typeof window !== 'undefined') {
        window.addEventListener('focus', () => {
          this.checkLiveStateAndNotify();
        });
      }
    }
  }

  public getStatus(): BluetoothConnectionStatus {
    return this.status;
  }

  public getStatusMessage(): string {
    return this.statusMessage;
  }

  public getConnectedDevice(): BluetoothDevice | null {
    return this.connectedDevice;
  }

  public getLatestReading(): AmmoniSenseReading | null {
    return this.latestReading;
  }

  public onReading(listener: ReadingListener): () => void {
    this.readingListeners.push(listener);
    return () => {
      this.readingListeners = this.readingListeners.filter((l) => l !== listener);
    };
  }

  public onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.push(listener);
    return () => {
      this.statusListeners = this.statusListeners.filter((l) => l !== listener);
    };
  }

  private notifyReadingListeners(reading: AmmoniSenseReading) {
    this.readingListeners.forEach((fn) => fn(reading));
  }

  private setStatus(status: BluetoothConnectionStatus, message: string) {
    this.status = status;
    this.statusMessage = message;
    this.statusListeners.forEach((fn) => fn(status, message));
  }

  /**
   * Check LIVE Bluetooth state (never cached).
   * Uses bluetoothSerial.isEnabled() directly.
   */
  public async checkLiveBluetoothEnabled(): Promise<boolean> {
    try {
      const bt = typeof window !== 'undefined' ? window.bluetoothSerial : undefined;
      if (!bt || typeof bt.isEnabled !== 'function') {
        // In development/browser environment
        return true;
      }

      return new Promise<boolean>((resolve) => {
        try {
          bt.isEnabled(
            () => resolve(true),
            () => resolve(false)
          );
        } catch {
          resolve(false);
        }
      });
    } catch {
      return true;
    }
  }

  /**
   * Checks live state and notifies listeners if turned off or on.
   */
  public async checkLiveStateAndNotify(): Promise<boolean> {
    try {
      const isEnabled = await this.checkLiveBluetoothEnabled();
      if (!isEnabled) {
        if (this.status === 'connected' || this.status === 'connecting') {
          this.resetLocalState();
        }
        this.setStatus('bluetooth_off', 'Bluetooth is off. Please turn it on.');
        return false;
      }

      if (this.status === 'bluetooth_off') {
        this.setStatus('idle', 'Bluetooth is on. Ready to connect.');
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Fully resets all connection state, timers, buffers, and flags.
   */
  public resetLocalState(): void {
    if (this.connectTimeoutTimer) {
      clearTimeout(this.connectTimeoutTimer);
      this.connectTimeoutTimer = null;
    }

    this.isConnecting = false;
    this.streamBuffer.reset();
    this.connectedDevice = null;

    const bt = typeof window !== 'undefined' ? window.bluetoothSerial : undefined;
    if (bt && typeof bt.disconnect === 'function') {
      try {
        bt.disconnect(
          () => {},
          () => {}
        );
      } catch {
        // ignore disconnect cleanup errors
      }
    }
  }

  /**
   * Finds the AmmoniSense device via paired devices or unpaired discovery.
   */
  public async findAmmoniSenseDevice(): Promise<BluetoothDevice | null> {
    const bt = typeof window !== 'undefined' ? window.bluetoothSerial : undefined;
    if (!bt) return null;

    // 1. Check bonded / paired devices first
    const pairedDevices = await new Promise<BluetoothDevice[]>((resolve) => {
      if (typeof bt.list !== 'function') return resolve([]);
      bt.list(
        (devs) => resolve(devs || []),
        () => resolve([])
      );
    });

    const pairedAmmoniSense = pairedDevices.find(
      (d) => d && d.name && d.name.trim().toLowerCase() === BluetoothClassicService.TARGET_DEVICE_NAME.toLowerCase()
    );
    if (pairedAmmoniSense) {
      return pairedAmmoniSense;
    }

    // 2. Discover unpaired devices if not already paired
    const discoveredDevices = await new Promise<BluetoothDevice[]>((resolve) => {
      if (typeof bt.discoverUnpaired !== 'function') return resolve([]);
      bt.discoverUnpaired(
        (devs) => resolve(devs || []),
        () => resolve([])
      );
    });

    const discoveredAmmoniSense = discoveredDevices.find(
      (d) => d && d.name && d.name.trim().toLowerCase() === BluetoothClassicService.TARGET_DEVICE_NAME.toLowerCase()
    );

    return discoveredAmmoniSense || null;
  }

  /**
   * Connect to AmmoniSense ESP32 over Classic Bluetooth Serial (SPP).
   */
  public async connect(): Promise<AmmoniSenseReading | null> {
    // 1. Prevent duplicate concurrent connection attempts
    if (this.isConnecting) {
      return null;
    }

    // 2. Fully reset state prior to starting a fresh attempt
    this.resetLocalState();
    this.isConnecting = true;

    // 3. Live check: Verify Bluetooth is actually turned ON right now
    const isEnabled = await this.checkLiveBluetoothEnabled();
    if (!isEnabled) {
      this.isConnecting = false;
      this.setStatus('bluetooth_off', 'Bluetooth is off. Please turn it on.');
      return null;
    }

    const bt = typeof window !== 'undefined' ? window.bluetoothSerial : undefined;
    if (!bt) {
      this.isConnecting = false;
      this.setStatus('failed', 'Bluetooth Serial plugin not available in this environment.');
      return null;
    }

    this.setStatus('scanning', 'Searching for AmmoniSense sensor...');

    // 4. Find device by exact name "AmmoniSense"
    let targetDevice: BluetoothDevice | null = null;
    try {
      targetDevice = await this.findAmmoniSenseDevice();
    } catch (err: any) {
      console.warn('[BluetoothClassic] Error searching for devices:', err);
    }

    if (!targetDevice) {
      this.isConnecting = false;
      this.setStatus(
        'device_not_found',
        'Device not found. Make sure the AmmoniSense sensor is powered on and nearby.'
      );
      return null;
    }

    // 5. Initiate connection with 10–15s connect timeout (12s)
    this.setStatus('connecting', `Connecting to ${targetDevice.name}...`);
    const deviceAddress = targetDevice.address || targetDevice.id;

    return new Promise<AmmoniSenseReading | null>((resolve) => {
      let isSettled = false;

      // Timeout handler: Cancels attempt on timeout and resets to ready state
      this.connectTimeoutTimer = setTimeout(() => {
        if (!isSettled) {
          isSettled = true;
          this.resetLocalState();
          this.setStatus(
            'device_not_found',
            'Connection timed out. Make sure the AmmoniSense sensor is powered on and nearby.'
          );
          resolve(null);
        }
      }, BluetoothClassicService.CONNECT_TIMEOUT_MS);

      const onConnectSuccess = () => {
        if (isSettled) return;
        isSettled = true;
        if (this.connectTimeoutTimer) {
          clearTimeout(this.connectTimeoutTimer);
          this.connectTimeoutTimer = null;
        }

        this.isConnecting = false;
        this.connectedDevice = targetDevice;
        this.setStatus('connected', `Connected to ${targetDevice?.name}`);

        // Subscribe to newline-delimited stream
        this.startDataSubscription();
        resolve(this.latestReading);
      };

      const onConnectFailure = (err: any) => {
        if (isSettled) return;
        isSettled = true;
        if (this.connectTimeoutTimer) {
          clearTimeout(this.connectTimeoutTimer);
          this.connectTimeoutTimer = null;
        }

        this.resetLocalState();
        const errStr = typeof err === 'string' ? err : err?.message || 'Connection failed';
        console.warn('[BluetoothClassic] Connect failure:', errStr);
        this.setStatus('failed', 'Device not ready. Make sure the AmmoniSense sensor is powered on.');
        resolve(null);
      };

      // Call connect (or connectInsecure if regular fails)
      bt.connect(deviceAddress, onConnectSuccess, (err) => {
        if (typeof bt.connectInsecure === 'function') {
          bt.connectInsecure(deviceAddress, onConnectSuccess, onConnectFailure);
        } else {
          onConnectFailure(err);
        }
      });
    });
  }

  /**
   * Subscribes to the raw incoming stream, buffers chunks, and parses lines.
   */
  private startDataSubscription() {
    const bt = typeof window !== 'undefined' ? window.bluetoothSerial : undefined;
    if (!bt) return;

    bt.subscribe(
      '\n',
      (data: string) => {
        if (!data) return;
        const lines = this.streamBuffer.append(data);
        for (const line of lines) {
          const reading = parseAmmoniSenseLine(line);
          if (reading) {
            this.latestReading = reading;
            this.notifyReadingListeners(reading);
            this.broadcastReading(reading);
          }
        }
      },
      (err) => {
        console.warn('[BluetoothClassic] Stream error or disconnected:', err);
        this.resetLocalState();
        this.setStatus('disconnected', 'Device disconnected.');
      }
    );
  }

  /**
   * Broadcast reading across tabs / windows
   */
  private broadcastReading(reading: AmmoniSenseReading) {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({
          type: 'CLASSIC_SPP_READING',
          payload: reading,
        });
      } catch {
        // ignore broadcast serialization issues
      }
    }
  }

  /**
   * Explicitly disconnects and cleans up connection state.
   */
  public disconnect(): void {
    this.resetLocalState();
    this.setStatus('disconnected', 'Disconnected from device.');
  }
}

export const bluetoothClassicService = new BluetoothClassicService();
export default bluetoothClassicService;
