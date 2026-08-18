/**
 * BLE Service for AmmoniSense
 * Supports Web Bluetooth API for live hardware ESP32 node connections
 */

export interface BLEReading {
  device_uid: string;
  ammonia: number; // NH3 in ppm
  temperature: number; // °C
  humidity: number; // %
  battery: number; // %
  rssi?: number; // dBm signal strength
  timestamp: string;
}

export type BLEConnectionState =
  | 'disconnected'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'streaming';

export type BLEListener = (reading: BLEReading) => void;
export type BLEStateListener = (state: BLEConnectionState) => void;

class BLEService {
  private currentState: BLEConnectionState = 'disconnected';
  private readingListeners: BLEListener[] = [];
  private stateListeners: BLEStateListener[] = [];
  private bluetoothDevice: any = null;
  private gattServer: any = null;
  private broadcastChannel: BroadcastChannel | null = null;

  public static SERVICE_UUID = '0000181a-0000-1000-8000-00805f9b34fb';
  public static AMMONIA_CHAR_UUID = '00002a6e-0000-1000-8000-00805f9b34fb';