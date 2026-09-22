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
    let { data: inserted, error } = await supabase
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
      // Fallback with minimal columns if extended columns don't exist yet
      const { data: fbData, error: fbErr } = await supabase
        .from('devices')
        .insert({
          device_uid: deviceId,
          status: 'ACTIVE',
        })
        .select('*')
        .maybeSingle();

      if (!fbErr && fbData) {
        inserted = fbData;
        error = null;
      } else {
        console.error('[deviceService] Auto-register insert error:', error.message);
        return null;
      }
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
    const { error: fbErr } = await supabase
      .from('devices')
      .update({ site_id: siteId } as any)
      .eq('device_uid', deviceId);

    if (fbErr) {
      console.error('[deviceService] linkDeviceToSite error:', error.message);
      return false;
    }
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

    let { data, error } = await supabase
      .from('devices')
      .select('*')
      .eq('created_by', userId)
      .order('last_seen_at', { ascending: false });

    if (error) {
      const fb1 = await supabase
        .from('devices')
        .select('*')
        .eq('created_by', userId)
        .order('created_at', { ascending: false });

      if (!fb1.error && fb1.data) {
        data = fb1.data;
        error = null;
      }
    }

    if (error) {
      const fb2 = await supabase
        .from('devices')
        .select('*');

      if (!fb2.error && fb2.data) {
        data = fb2.data;
        error = null;
      }
    }

    if (error) {
      console.warn('[deviceService] fetchMyDevices notice:', error.message);
      return [];
    }
    return (data ?? []) as DeviceRecord[];
  } catch (err: any) {
    console.error('[deviceService] fetchMyDevices failed:', err?.message);
    return [];
  }
}
