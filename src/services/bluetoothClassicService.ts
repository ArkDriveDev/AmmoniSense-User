import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { PluginListenerHandle } from '@capacitor/core';
import { BluetoothSerial } from '@shoerofi/capacitor-bluetooth-serial';
import type {
  BluetoothDevice,
  BluetoothConnectionState,
} from '@shoerofi/capacitor-bluetooth-serial';
import { AmmoniSenseReading, BluetoothConnectionStatus } from '../types/schema';
import { parseAmmoniSenseLine, SerialStreamBuffer } from '../utils/serialParser';

export type { BluetoothDevice };
export type ReadingListener = (reading: AmmoniSenseReading) => void;
export type StatusListener = (status: BluetoothConnectionStatus, message?: string) => void;

class BluetoothClassicService {
  public static readonly TARGET_DEVICE_NAME = 'AmmoniSense';
  public static readonly CONNECT_TIMEOUT_MS = 15000;
  public static readonly BROADCAST_CHANNEL = 'ammonisense_classic_spp_stream';
  public static readonly STORAGE_KEY_DEVICE_UID = 'ammonisense_device_uid';

  private status: BluetoothConnectionStatus = 'idle';
  private statusMessage = '';
  private isConnecting = false;
  private connectedAddress: string | null = null;
  private connectedDevice: BluetoothDevice | null = null;
  private latestReading: AmmoniSenseReading | null = null;

  private streamBuffer = new SerialStreamBuffer();
  private readingListeners: ReadingListener[] = [];
  private statusListeners: StatusListener[] = [];
  private broadcastChannel: BroadcastChannel | null = null;

  private connectTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private notificationListenerHandle: PluginListenerHandle | null = null;
  private connectionChangeHandle: PluginListenerHandle | null = null;
  private notificationEventName: string | null = null;

  constructor() {
    this.initBroadcastChannel();
    this.initAppResumeListener();
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(BluetoothClassicService.STORAGE_KEY_DEVICE_UID);
        if (saved && saved.trim()) {
          this.connectedAddress = saved.trim();
        }
      } catch { /* ignore */ }
    }
  }

  // ---------------------------------------------------------------------------
  // Init helpers
  // ---------------------------------------------------------------------------

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

  private initAppResumeListener() {
    try {
      if (Capacitor.isNativePlatform()) {
        App.addListener('appStateChange', async (state) => {
          if (state.isActive) {
            await this.checkLiveStateAndNotify();
          }
        }).catch(() => {});
      } else if (typeof window !== 'undefined') {
        window.addEventListener('focus', () => this.checkLiveStateAndNotify());
      }
    } catch {
      if (typeof window !== 'undefined') {
        window.addEventListener('focus', () => this.checkLiveStateAndNotify());
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Public getters
  // ---------------------------------------------------------------------------

  public getStatus(): BluetoothConnectionStatus { return this.status; }
  public getStatusMessage(): string { return this.statusMessage; }
  public getConnectedDevice(): BluetoothDevice | null { return this.connectedDevice; }
  public getLatestReading(): AmmoniSenseReading | null { return this.latestReading; }
  public getDeviceUid(): string | null {
    if (this.connectedAddress && this.connectedAddress.trim()) {
      return this.connectedAddress.trim();
    }
    if (typeof localStorage !== 'undefined') {
      try {
        const saved = localStorage.getItem(BluetoothClassicService.STORAGE_KEY_DEVICE_UID);
        if (saved && saved.trim()) return saved.trim();
      } catch { /* ignore */ }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Listener registration
  // ---------------------------------------------------------------------------

  public onReading(listener: ReadingListener): () => void {
    this.readingListeners.push(listener);
    return () => { this.readingListeners = this.readingListeners.filter(l => l !== listener); };
  }

  public onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.push(listener);
    return () => { this.statusListeners = this.statusListeners.filter(l => l !== listener); };
  }

  private notifyReadingListeners(reading: AmmoniSenseReading) {
    this.readingListeners.forEach(fn => fn(reading));
  }

  private setStatus(status: BluetoothConnectionStatus, message: string) {
    this.status = status;
    this.statusMessage = message;
    this.statusListeners.forEach(fn => fn(status, message));
  }

  // ---------------------------------------------------------------------------
  // Bluetooth enabled check
  // ---------------------------------------------------------------------------

  public async checkLiveBluetoothEnabled(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) return true;
    try {
      const result = await BluetoothSerial.isEnabled();
      return result.enabled;
    } catch {
      return true;
    }
  }

  public async checkLiveStateAndNotify(): Promise<boolean> {
    if (this.status !== 'connected' && this.status !== 'connecting') return true;
    try {
      const enabled = await this.checkLiveBluetoothEnabled();
      if (!enabled) {
        this.resetLocalState();
        this.setStatus('bluetooth_off', 'Bluetooth is off. Please turn it on.');
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // State reset
  // ---------------------------------------------------------------------------

  public resetLocalState(): void {
    if (this.connectTimeoutTimer) {
      clearTimeout(this.connectTimeoutTimer);
      this.connectTimeoutTimer = null;
    }

    this.isConnecting = false;
    this.streamBuffer.reset();

    // Tear down notification listener
    if (this.notificationListenerHandle) {
      this.notificationListenerHandle.remove().catch(() => {});
      this.notificationListenerHandle = null;
    }

    // Tear down connection-change listener
    if (this.connectionChangeHandle) {
      this.connectionChangeHandle.remove().catch(() => {});
      this.connectionChangeHandle = null;
    }

    // Disable notifications on the device if we had one connected
    if (this.connectedAddress && this.notificationEventName) {
      BluetoothSerial.disableNotifications({ address: this.connectedAddress }).catch(() => {});
    }

    // Disconnect
    if (this.connectedAddress) {
      BluetoothSerial.disconnect({ address: this.connectedAddress }).catch(() => {});
    }

    this.connectedAddress = null;
    this.connectedDevice = null;
    this.notificationEventName = null;
  }

  // ---------------------------------------------------------------------------
  // Scan for unpaired + paired devices (in-app pairing)
  // ---------------------------------------------------------------------------

  /**
   * Returns all visible AmmoniSense devices.
   * scan() triggers Android 12+ permission dialog + pair dialog internally.
   * Falls back to getPairedDevices() if scan times out or fails.
   */
  public async findAmmoniSenseDevices(): Promise<BluetoothDevice[]> {
    if (!Capacitor.isNativePlatform()) return [];

    const TARGET = BluetoothClassicService.TARGET_DEVICE_NAME.toLowerCase();

    // 1. Try paired devices first (fast path)
    let paired: BluetoothDevice[] = [];
    try {
      const result = await BluetoothSerial.getPairedDevices();
      paired = (result.devices || []).filter(
        d => d?.name?.trim().toLowerCase() === TARGET
      );
    } catch (e) {
      console.warn('[BT] getPairedDevices failed:', e);
    }

    if (paired.length > 0) return paired;

    // 2. In-app scan (triggers pairing dialog for unpaired devices)
    try {
      this.setStatus('scanning', 'Scanning for AmmoniSense nearby...');
      const scanResult = await BluetoothSerial.scan();
      const scanned = (scanResult.devices || []).filter(
        d => d?.name?.trim().toLowerCase() === TARGET
      );
      if (scanned.length > 0) return scanned;
    } catch (e) {
      console.warn('[BT] scan() failed:', e);
    }

    return [];
  }

  // ---------------------------------------------------------------------------
  // Connect
  // ---------------------------------------------------------------------------

  public async connect(): Promise<AmmoniSenseReading | null> {
    if (this.isConnecting) return null;

    this.resetLocalState();
    this.isConnecting = true;

    // 1. Check Bluetooth is on
    const enabled = await this.checkLiveBluetoothEnabled();
    if (!enabled) {
      this.isConnecting = false;
      this.setStatus('bluetooth_off', 'Bluetooth is off. Please turn it on and retry.');
      return null;
    }

    this.setStatus('scanning', 'Searching for AmmoniSense sensor...');

    // 2. Find device (paired first, then in-app scan)
    let devices: BluetoothDevice[] = [];
    try {
      devices = await this.findAmmoniSenseDevices();
    } catch (err) {
      console.warn('[BT] Error finding devices:', err);
    }

    if (devices.length === 0) {
      this.isConnecting = false;
      this.setStatus(
        'device_not_found',
        'AmmoniSense not found. Make sure the sensor is on and nearby, then tap Retry.'
      );
      return null;
    }

    const target = devices[0];
    const address = (target.address || target.id || '').trim();

    if (!address) {
      this.isConnecting = false;
      this.setStatus('device_not_found', 'Device found but has no valid address. Tap Retry.');
      return null;
    }

    this.setStatus('connecting', `Connecting to ${target.name}...`);

    // 3. Connect with timeout
    return new Promise<AmmoniSenseReading | null>((resolve) => {
      let settled = false;

      this.connectTimeoutTimer = setTimeout(() => {
        if (!settled) {
          settled = true;
          this.resetLocalState();
          this.setStatus(
            'device_not_found',
            'Connection timed out. Make sure the AmmoniSense sensor is powered on and nearby.'
          );
          resolve(null);
        }
      }, BluetoothClassicService.CONNECT_TIMEOUT_MS);

      const finish = (err?: any) => {
        if (settled) return;
        settled = true;
        if (this.connectTimeoutTimer) {
          clearTimeout(this.connectTimeoutTimer);
          this.connectTimeoutTimer = null;
        }

        if (err) {
          this.resetLocalState();
          const errStr = typeof err === 'string' ? err : err?.message || 'Connection failed';
          console.warn('[BT] Connect failure:', errStr);
          this.setStatus('failed', 'Device not ready. Make sure the AmmoniSense sensor is powered on.');
          resolve(null);
          return;
        }

        // Connected successfully
        this.isConnecting = false;
        this.connectedAddress = address;
        this.connectedDevice = target;
        try {
          if (typeof localStorage !== 'undefined' && address) {
            localStorage.setItem(BluetoothClassicService.STORAGE_KEY_DEVICE_UID, address);
          }
        } catch { /* ignore */ }
        this.setStatus('connected', `Connected to ${target.name}`);
        this.startDataSubscription(address);
        this.startConnectionChangeListener(address);
        resolve(this.latestReading);
      };

      // Try connect, fall back to connectInsecure on failure
      BluetoothSerial.connect({ address })
        .then(() => finish())
        .catch(() => {
          BluetoothSerial.connectInsecure({ address })
            .then(() => finish())
            .catch(err => finish(err));
        });
    });
  }

  // ---------------------------------------------------------------------------
  // Notification stream subscription
  // ---------------------------------------------------------------------------

  private async startDataSubscription(address: string): Promise<void> {
    try {
      // Disable any stale notifications first
      await BluetoothSerial.disableNotifications({ address }).catch(() => {});

      const result = await BluetoothSerial.enableNotifications({
        address,
        delimiter: '\n',
      });

      this.notificationEventName = result.eventName;

      this.notificationListenerHandle = await BluetoothSerial.addListener(
        result.eventName,
        (event: any) => {
          const raw: string = typeof event === 'string' ? event : (event?.value ?? event?.data ?? '');
          if (!raw) return;
          const lines = this.streamBuffer.append(raw.includes('\n') ? raw : `${raw}\n`);
          for (const line of lines) {
            const reading = parseAmmoniSenseLine(line);
            if (reading) {
              this.latestReading = reading;
              this.notifyReadingListeners(reading);
              this.broadcastReading(reading);
            }
          }
        }
      );
    } catch (subErr) {
      console.warn('[BT] Notification subscription error:', subErr);
    }
  }

  // ---------------------------------------------------------------------------
  // Connection-change event listener
  // ---------------------------------------------------------------------------

  private async startConnectionChangeListener(address: string): Promise<void> {
    try {
      this.connectionChangeHandle = await BluetoothSerial.addListener(
        'onConnectionChange',
        (event: { device?: BluetoothDevice; state: BluetoothConnectionState }) => {
          const deviceAddress = (event.device?.address || event.device?.id || '').trim();
          // Only react to events for our device
          if (deviceAddress && deviceAddress !== address) return;

          if (event.state === 'DISCONNECTED' || event.state === 'CONNECTION_FAILED') {
            if (this.status === 'connected') {
              this.resetLocalState();
              this.setStatus('disconnected', 'Device disconnected.');
            }
          }
        }
      );
    } catch (e) {
      console.warn('[BT] onConnectionChange listener error:', e);
    }
  }

  // ---------------------------------------------------------------------------
  // Broadcast
  // ---------------------------------------------------------------------------

  private broadcastReading(reading: AmmoniSenseReading) {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ type: 'CLASSIC_SPP_READING', payload: reading });
      } catch { /* ignore */ }
    }
  }

  // ---------------------------------------------------------------------------
  // Disconnect
  // ---------------------------------------------------------------------------

  public disconnect(): void {
    this.resetLocalState();
    this.setStatus('disconnected', 'Disconnected from device.');
  }
}

export const bluetoothClassicService = new BluetoothClassicService();
export default bluetoothClassicService;
