import { Device } from '@capacitor/device';
import { supabase } from './supabase';

export type DeviceApprovalState = 'APPROVED' | 'PENDING' | 'BLOCKED';

export interface DeviceCheckResult {
  status: DeviceApprovalState;
  deviceIdentifier: string;
}

export async function getDeviceDetails(): Promise<{ identifier: string; name: string }> {
  const idInfo = await Device.getId();
  let name = 'User Device';
  try {
    const info = await Device.getInfo();
    const parts = [info.manufacturer, info.model].filter(Boolean).join(' ').trim();
    name = info.name || parts || info.platform || 'User Device';
  } catch {
    // Ignore device info fallback error
  }
  return { identifier: idInfo.identifier, name };
}

export async function verifyAndRegisterDevice(profileId: string): Promise<DeviceCheckResult> {
  const { identifier: device_identifier, name: device_name } = await getDeviceDetails();
  const now = new Date().toISOString();

  const { data: existing, error: selectError } = await supabase
    .from('user_devices')
    .select('id, status')
    .eq('profile_id', profileId)
    .eq('device_identifier', device_identifier)
    .maybeSingle();

  if (selectError) {
    console.warn('[deviceApproval] Failed to query user_devices:', selectError.message);
  }

  let status: DeviceApprovalState = 'PENDING';

  if (!existing) {
    const { error: insertError } = await supabase.from('user_devices').insert({
      profile_id: profileId,
      device_identifier,
      device_name,
      status: 'PENDING',
      last_seen_at: now,
    });
    if (insertError) {
      console.warn('[deviceApproval] Failed to insert pending device:', insertError.message);
    }
    status = 'PENDING';
  } else {
    const rawStatus = String(existing.status || 'PENDING').toUpperCase();
    status = rawStatus === 'APPROVED' ? 'APPROVED' : rawStatus === 'BLOCKED' ? 'BLOCKED' : 'PENDING';
  }

  // Call Edge Function register-device to update ip_address and last_seen_at (non-blocking on failure)
  try {
    const { error: fnError } = await supabase.functions.invoke('register-device', {
      body: { profile_id: profileId, device_identifier, device_name },
    });
    if (fnError) {
      console.warn('[deviceApproval] register-device function warning:', fnError.message);
    }
  } catch (err) {
    console.warn('[deviceApproval] register-device invocation failed:', err);
  }

  return { status, deviceIdentifier: device_identifier };
}
