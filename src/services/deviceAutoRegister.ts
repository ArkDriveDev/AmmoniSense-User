import { autoRegisterDevice, DeviceRecord } from './deviceService';

export type { DeviceRecord };

/**
 * Auto-registers a BLE sensor device upon connection or discovery.
 * Inserts a new record if new, or updates last_seen_at if existing.
 */
export async function autoRegisterBLEDevice(
  deviceId: string,
  deviceName?: string
): Promise<DeviceRecord | null> {
  if (!deviceId) return null;
  return autoRegisterDevice(deviceId, deviceName);
}
