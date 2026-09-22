import { supabase } from './supabase';

export interface DeviceRecord {
  id: number;
  device_uid: string;
  device_name: string | null;
  inspection_site_id: number | null;
  firmware_version: string | null;
  status: string;
  first_seen_at: string | null;
  last_seen_at: string | null;
  installed_at: string;
  created_at: string;
  created_by: string | null;
}

/**
 * Auto-register a BLE device in Supabase.
 * - Inserts if device_uid is new (first_seen_at = now).
 * - Updates last_seen_at if device already exists.
 * Returns the upserted device record.
 */
export async function autoRegisterDevice(
  deviceId: string,
  deviceName?: string
): Promise<DeviceRecord | null> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id ?? null;
    const now = new Date().toISOString();
    const label = deviceName || `Sensor ${deviceId.slice(-6)}`;

    // Check if device already exists
    const { data: existing } = await supabase
      .from('devices')
      .select('*')
      .eq('device_uid', deviceId)
      .maybeSingle();

    if (existing) {
      // Update last_seen_at only
      const { data: updated } = await supabase
        .from('devices')
        .update({ last_seen_at: now })
        .eq('device_uid', deviceId)
        .select('*')
        .maybeSingle();
      return updated as DeviceRecord | null;
    }

    // Insert new device record
    const { data: inserted, error } = await supabase
      .from('devices')
      .insert({
        device_uid: deviceId,
        device_name: label,
        status: 'ACTIVE',
        first_seen_at: now,
        last_seen_at: now,
        created_by: userId,
      })
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('[deviceService] Auto-register insert error:', error.message);
      return null;
    }

    return inserted as DeviceRecord | null;
  } catch (err: any) {
    console.error('[deviceService] autoRegisterDevice failed:', err?.message);
    return null;
  }
}

/**
 * Link an existing device to a monitoring site.
 */
export async function linkDeviceToSite(
  deviceId: string,
  siteId: number
): Promise<boolean> {
  const { error } = await supabase
    .from('devices')
    .update({ inspection_site_id: siteId })
    .eq('device_uid', deviceId);

  if (error) {
    console.error('[deviceService] linkDeviceToSite error:', error.message);
    return false;
  }
  return true;
}

/**
 * Fetch all devices created by (or seen by) the current user.
 */
export async function fetchMyDevices(): Promise<DeviceRecord[]> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return [];

    const { data, error } = await supabase
      .from('devices')
      .select('*')
      .eq('created_by', userId)
      .order('last_seen_at', { ascending: false });

    if (error) {
      console.error('[deviceService] fetchMyDevices error:', error.message);
      return [];
    }
    return (data ?? []) as DeviceRecord[];
  } catch (err: any) {
    console.error('[deviceService] fetchMyDevices failed:', err?.message);
    return [];
  }
}
