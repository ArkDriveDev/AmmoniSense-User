// SyncService.ts
// Handles auto-syncing of IndexedDB queued items when back online, with retry logic.

import offlineStorage, { QueueItem } from './OfflineStorageService';
import { supabase } from './supabase';
import { registerSiteWithPhoto } from './siteService';
import { uploadPhotoPair, getSignedPhotoUrl } from './photoStorageService';

export type SyncEventType = 'status_change' | 'sync_start' | 'sync_progress' | 'sync_complete' | 'sync_error';
export type SyncEventListener = (event: { type: SyncEventType; isOnline: boolean; pendingCount: number; activeItem?: QueueItem; message?: string }) => void;

class SyncService {
  private onlineStatus: boolean = navigator.onLine;
  private isSyncing: boolean = false;
  private listeners: Set<SyncEventListener> = new Set();

  constructor() {
    this.initNetworkListeners();
  }

  private initNetworkListeners() {
    window.addEventListener('online', () => {
      console.log('📶 Network status: ONLINE');
      this.onlineStatus = true;
      this.notifyListeners('status_change');
      // Auto-trigger sync when returning online
      this.syncAll();
    });

    window.addEventListener('offline', () => {
      console.log('📡 Network status: OFFLINE');
      this.onlineStatus = false;
      this.notifyListeners('status_change');
    });
  }

  public isOnline(): boolean {
    return this.onlineStatus;
  }

  public subscribe(listener: SyncEventListener): () => void {
    this.listeners.add(listener);
    // Initial notification
    this.getPendingCount().then((count) => {
      listener({ type: 'status_change', isOnline: this.onlineStatus, pendingCount: count });
    });

    return () => {
      this.listeners.delete(listener);
    };
  }

  private async notifyListeners(type: SyncEventType, activeItem?: QueueItem, message?: string) {
    const pendingCount = await this.getPendingCount();
    this.listeners.forEach((listener) => {
      listener({
        type,
        isOnline: this.onlineStatus,
        pendingCount,
        activeItem,
        message,
      });
    });
  }

  public async getPendingCount(): Promise<number> {
    try {
      const queue = await offlineStorage.getQueue();
      return queue.filter((item) => item.status !== 'failed').length;
    } catch {
      return 0;
    }
  }

  // ==========================================
  // SYNC EXECUTION ENGINE
  // ==========================================

  public async resync(): Promise<{ success: number; failed: number }> {
    if (!this.onlineStatus) return { success: 0, failed: 0 };
    try {
      const queue = await offlineStorage.getQueue();
      for (const item of queue) {
        if (item.status === 'failed') {
          await offlineStorage.updateQueueItemStatus(item.id, 'pending');
        }
      }
    } catch (e) {
      console.warn('[SyncService] Could not reset failed items for resync:', e);
    }
    const result = await this.syncAll();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('schedules_updated'));
      window.dispatchEvent(new CustomEvent('tags_updated'));
      window.dispatchEvent(new CustomEvent('site_synced'));
    }
    return result;
  }

  public async syncAll(): Promise<{ success: number; failed: number }> {
    if (!this.onlineStatus || this.isSyncing) {
      return { success: 0, failed: 0 };
    }

    this.isSyncing = true;
    let successCount = 0;
    let failedCount = 0;

    try {
      const queue = await offlineStorage.getQueue();
      const typeOrder: Record<string, number> = {
        'SITE_REGISTRATION': 1,
        'INSPECTION_SCHEDULE': 2,
        'INSPECTION_TAG': 3,
        'SENSOR_READING': 4,
        'DEVICE_TAG': 5,
      };

      const pendingItems = queue
        .filter((item) => item.status !== 'failed' || item.retryCount < 3)
        .sort((a, b) => (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99));

      if (pendingItems.length === 0) {
        this.isSyncing = false;
        this.notifyListeners('sync_complete');
        return { success: 0, failed: 0 };
      }

      this.notifyListeners('sync_start');

      for (const item of pendingItems) {
        if (!this.onlineStatus) break; // Network lost mid-sync

        // Exponential backoff delay for items that failed previous attempts
        if (item.retryCount > 0) {
          const backoffDelay = Math.min(1000 * Math.pow(2, item.retryCount - 1), 15000);
          await new Promise((res) => setTimeout(res, backoffDelay));
        }

        try {
          await offlineStorage.updateQueueItemStatus(item.id, 'syncing');
          this.notifyListeners('sync_progress', item, `Syncing ${item.type}...`);

          await this.processItem(item);

          // Success: remove item from queue
          await offlineStorage.removeQueueItem(item.id);

          if (item.photoStoreId) {
            await offlineStorage.removePhoto(item.photoStoreId);
          }

          successCount++;
        } catch (err: any) {
          console.error(`Error syncing queue item ${item.id}:`, err);
          failedCount++;
          const errorMsg = err.message || 'Sync failed';
          await offlineStorage.updateQueueItemStatus(item.id, 'failed', errorMsg);
          this.notifyListeners('sync_error', item, errorMsg);
        }
      }
    } finally {
      this.isSyncing = false;
      this.notifyListeners('sync_complete');
    }

    return { success: successCount, failed: failedCount };
  }

  private async processItem(item: QueueItem): Promise<void> {
    switch (item.type) {
      case 'SENSOR_READING':
        await this.syncSensorReading(item);
        break;

      case 'SITE_REGISTRATION':
        await this.syncSiteRegistration(item);
        break;

      case 'DEVICE_TAG':
        await this.syncDeviceTag(item);
        break;

      case 'INSPECTION_SCHEDULE':
        await this.syncInspectionSchedule(item);
        break;

      case 'INSPECTION_TAG':
        await this.syncInspectionTag(item);
        break;

      default:
        throw new Error(`Unknown queue item type: ${item.type}`);
    }
  }

  private async syncSensorReading(item: QueueItem): Promise<void> {
    const payload = { ...item.payload };

    // 1. Upload photo if present in photo_store
    if (item.photoStoreId && !payload.photo_url) {
      const storedPhoto = await offlineStorage.getPhoto(item.photoStoreId);
      if (storedPhoto?.dataUrl) {
        const publicUrl = await this.uploadDataUrlToSupabase(storedPhoto.dataUrl);
        if (publicUrl) {
          payload.photo_url = publicUrl;
        }
      }
    }

    // 2. Ensure device exists in devices table before inserting sensor_data
    const deviceUid = payload.device_uid || 'ESP32-AMMONIA-NODE-01';
    await this.ensureDeviceExists(deviceUid);

    // 3. Insert into sensor_data table (with cascading schema-resilient retries)
    let { data: inserted, error } = await supabase
      .from('sensor_data')
      .insert([{ ...payload, device_uid: deviceUid }])
      .select('id')
      .maybeSingle();

    // Retry without inspection_photo_id if FK violation
    if (error && (error.message?.includes('inspection_photo') || error.code === '23503')) {
      const retryPayload = { ...payload, device_uid: deviceUid, inspection_photo_id: null };
      const { data: r2, error: e2 } = await supabase
        .from('sensor_data')
        .insert([retryPayload])
        .select('id')
        .maybeSingle();
      if (!e2 && r2) { inserted = r2; error = null; }
      else if (e2) { error = e2; }
    }

    // Retry without inspection_site_id if column missing from schema cache
    if (error && (
      error.message?.includes('inspection_site_id') ||
      error.code === '42703' ||
      error.code === 'PGRST204'
    )) {
      const { inspection_site_id: _s, inspection_photo_id: _p, ...minPayload } = payload;
      const { data: r3, error: e3 } = await supabase
        .from('sensor_data')
        .insert([{ ...minPayload, device_uid: deviceUid }])
        .select('id')
        .maybeSingle();
      if (!e3 && r3) { inserted = r3; error = null; }
      else if (e3) { error = e3; }
    }

    if (error) {
      throw new Error(`sensor_data insert error: ${error.message}`);
    }

    // 4. Mark photo as used in inspection_photos table if payload has photo_url
    if (payload.photo_url && inserted?.id) {
      try {
        await supabase
          .from('inspection_photos')
          .update({ sensor_data_id: inserted.id, is_used: true })
          .eq('photo_url', payload.photo_url);
      } catch (e) {
        console.warn('Could not update inspection_photos table:', e);
      }
    }
  }

  private async syncSiteRegistration(item: QueueItem): Promise<void> {
    let regResult: any = null;
    try {
      regResult = await registerSiteWithPhoto(item.payload);
    } catch (error: any) {
      throw new Error(`inspection_sites insert error: ${error.message}`);
    }

    const tempId = item.payload?.temp_id || item.payload?.id;
    const realSiteId = regResult?.site?.id;

    if (tempId && realSiteId) {
      try {
        const map = JSON.parse(localStorage.getItem('tempIdMap') || '{}');
        map[tempId] = realSiteId;
        if (item.payload.site_code) map[item.payload.site_code] = realSiteId;
        localStorage.setItem('tempIdMap', JSON.stringify(map));
      } catch (e) {
        console.warn('[SyncService] Could not save site tempIdMap:', e);
      }

      try {
        const allItems = await offlineStorage.getQueue();
        for (const qi of allItems) {
          if (qi.payload?.inspection_site_id === tempId) {
            qi.payload.inspection_site_id = realSiteId;
            await offlineStorage.updateQueueItemPayload(qi.id, qi.payload);
          }
        }
      } catch (e) {
        console.warn('[SyncService] Could not patch queued items with real site ID:', e);
      }
    }
    // Delete local OfflineSite record from IndexedDB & localStorage once synced to Supabase
    if (item.payload?.temp_id || item.payload?.id) {
      const tempId = item.payload.temp_id || item.payload.id;
      try {
        await offlineStorage.deleteOfflineSite(tempId);
        offlineStorage.removeSiteFromLocalStorage(tempId);
        if (item.payload.site_code) {
          offlineStorage.removeSiteFromLocalStorage(item.payload.site_code);
        }
      } catch (e) {
        console.warn('Could not remove local offline site record:', e);
      }
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('site_synced'));
      window.dispatchEvent(new CustomEvent('site_deleted'));
    }
  }

  private async syncDeviceTag(item: QueueItem): Promise<void> {
    const { error } = await supabase.from('devices').insert([item.payload]);
    if (error) {
      throw new Error(`devices insert error: ${error.message}`);
    }
  }

  private async syncInspectionSchedule(item: QueueItem): Promise<void> {
    const { temp_id, ...payload } = item.payload;

    // Resolve temp site ID → real BIGINT id before inserting
    if (typeof payload.inspection_site_id === 'string' && (payload.inspection_site_id.startsWith('temp_') || isNaN(Number(payload.inspection_site_id)))) {
      const tempSiteId = payload.inspection_site_id;
      try {
        const map = JSON.parse(localStorage.getItem('tempIdMap') || '{}');
        if (map[tempSiteId]) payload.inspection_site_id = map[tempSiteId];
      } catch { /* ignore */ }

      if (typeof payload.inspection_site_id === 'string' && (payload.inspection_site_id.startsWith('temp_') || isNaN(Number(payload.inspection_site_id)))) {
        const { data: site } = await supabase
          .from('inspection_sites')
          .select('id')
          .or(`site_code.eq.${tempSiteId},site_name.eq.${tempSiteId}`)
          .maybeSingle();
        if (site?.id) {
          payload.inspection_site_id = site.id;
          try {
            const map = JSON.parse(localStorage.getItem('tempIdMap') || '{}');
            map[tempSiteId] = site.id;
            localStorage.setItem('tempIdMap', JSON.stringify(map));
          } catch { /* ignore */ }
        }
      }
    }

    const { data: user } = await supabase.auth.getUser();

    const { data: inserted, error } = await supabase
      .from('inspection_schedules')
      .insert([{ ...payload, offline_temp_id: temp_id || null, created_by: user.user?.id }])
      .select('id')
      .single();
    if (error) throw new Error(`inspection_schedules insert error: ${error.message}`);

    // Persist temp → real ID mapping so queued tags can resolve it
    if (temp_id && inserted?.id) {
      try {
        const map = JSON.parse(localStorage.getItem('tempIdMap') || '{}');
        map[temp_id] = inserted.id;
        localStorage.setItem('tempIdMap', JSON.stringify(map));
      } catch (e) {
        console.warn('[SyncService] Could not save tempIdMap:', e);
      }

      // Patch any pending INSPECTION_TAG queue items referencing this temp ID
      try {
        const allItems = await offlineStorage.getQueue();
        for (const qi of allItems) {
          if (qi.type === 'INSPECTION_TAG' && qi.payload?.inspection_schedule_id === temp_id) {
            qi.payload.inspection_schedule_id = inserted.id;
            await offlineStorage.updateQueueItemPayload(qi.id, qi.payload);
          }
        }
      } catch (e) {
        console.warn('[SyncService] Could not patch queued tags with real schedule ID:', e);
      }
    }

    if (temp_id) offlineStorage.removeOfflineSchedule(temp_id);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('schedules_updated'));
  }

  private async syncInspectionTag(item: QueueItem): Promise<void> {
    const { temp_id, ...payload } = item.payload;

    // Check if tag with offline_temp_id already exists in Supabase to prevent duplicates
    if (temp_id) {
      try {
        const { data: existingTag } = await supabase
          .from('inspection_tags')
          .select('id')
          .eq('offline_temp_id', temp_id)
          .maybeSingle();
        if (existingTag) {
          console.log(`[SyncService] Tag with temp_id ${temp_id} already synced, skipping duplicate.`);
          offlineStorage.removeOfflineTag(temp_id);
          return;
        }
      } catch (err) {
        console.warn('[SyncService] Duplicate check notice:', err);
      }
    }

    // Preserve zero-value readings correctly
    const parseNum = (v: any, fallback: number): number =>
      v !== undefined && v !== null && !isNaN(Number(v)) ? Number(v) : fallback;

    payload.ammonia = parseNum(payload.ammonia, 0);
    payload.temperature = parseNum(payload.temperature, 0);
    payload.humidity = parseNum(payload.humidity, 0);
    payload.battery = parseNum(payload.battery, 100);
    payload.latitude = parseNum(payload.latitude, 0);
    payload.longitude = parseNum(payload.longitude, 0);

    // Ensure device is registered — if it can't be, null out device_uid to avoid FK violation
    if (payload.device_uid) {
      try {
        await this.ensureDeviceExists(payload.device_uid);
        // Verify the device row actually exists before using the FK
        const { data: devCheck } = await supabase
          .from('devices')
          .select('device_uid')
          .eq('device_uid', payload.device_uid)
          .maybeSingle();
        if (!devCheck) {
          console.warn(`[SyncService] Device "${payload.device_uid}" not found after ensure — dropping FK to avoid constraint error.`);
          payload.device_uid = null;
        }
      } catch (e) {
        console.warn('[SyncService] ensureDeviceExists failed — nulling device_uid for safe insert:', e);
        payload.device_uid = null;
      }
    }

    // Resolve temp schedule ID → real BIGINT id before inserting
    if (typeof payload.inspection_schedule_id === 'string'
        && payload.inspection_schedule_id.startsWith('temp_sched_')) {
      const tempSchedId = payload.inspection_schedule_id;
      // 1. Check in-memory localStorage map
      try {
        const map = JSON.parse(localStorage.getItem('tempIdMap') || '{}');
        if (map[tempSchedId]) {
          payload.inspection_schedule_id = map[tempSchedId];
        }
      } catch { /* ignore parse errors */ }

      // 2. Fallback: query DB by offline_temp_id if still unresolved
      if (typeof payload.inspection_schedule_id === 'string'
          && payload.inspection_schedule_id.startsWith('temp_sched_')) {
        const { data: sched } = await supabase
          .from('inspection_schedules')
          .select('id, inspection_site_id')
          .eq('offline_temp_id', tempSchedId)
          .maybeSingle();
        if (sched?.id) {
          payload.inspection_schedule_id = sched.id;
          if (!payload.inspection_site_id && sched.inspection_site_id) {
            payload.inspection_site_id = sched.inspection_site_id;
          }
          // Persist resolved mapping for future tags
          try {
            const map = JSON.parse(localStorage.getItem('tempIdMap') || '{}');
            map[tempSchedId] = sched.id;
            localStorage.setItem('tempIdMap', JSON.stringify(map));
          } catch { /* ignore */ }
        } else {
          throw new Error(`Cannot resolve schedule temp ID: ${tempSchedId}. Schedule may not have synced yet.`);
        }
      }
    }

    // Resolve temp site ID if present — tags do NOT require inspection_site_id!
    if (typeof payload.inspection_site_id === 'string' && (payload.inspection_site_id.startsWith('temp_') || isNaN(Number(payload.inspection_site_id)))) {
      const tempSiteId = payload.inspection_site_id;
      try {
        const map = JSON.parse(localStorage.getItem('tempIdMap') || '{}');
        if (map[tempSiteId]) payload.inspection_site_id = map[tempSiteId];
      } catch { /* ignore */ }
    }

    // Fallback: look up schedule's site if still unresolved
    if (typeof payload.inspection_site_id === 'string' && (payload.inspection_site_id.startsWith('temp_') || isNaN(Number(payload.inspection_site_id)))) {
      if (payload.inspection_schedule_id && typeof payload.inspection_schedule_id === 'number') {
        try {
          const { data: schedSite } = await supabase
            .from('inspection_schedules')
            .select('inspection_site_id')
            .eq('id', payload.inspection_schedule_id)
            .maybeSingle();
          if (schedSite?.inspection_site_id) {
            payload.inspection_site_id = schedSite.inspection_site_id;
          }
        } catch { /* ignore */ }
      }
    }

    // If inspection_site_id is still unresolved or non-numeric, null it out (do not require it)
    if (typeof payload.inspection_site_id === 'string' && (payload.inspection_site_id.startsWith('temp_') || isNaN(Number(payload.inspection_site_id)) || !payload.inspection_site_id.trim())) {
      payload.inspection_site_id = null;
    } else if (payload.inspection_site_id !== null && payload.inspection_site_id !== undefined) {
      payload.inspection_site_id = Number(payload.inspection_site_id) || null;
    } else {
      payload.inspection_site_id = null;
    }

    let photoData = payload.photo_url;
    let thumbData = payload.photo_thumbnail_url;
    if (item.photoStoreId && (!photoData || photoData.startsWith('data:'))) {
      const stored = await offlineStorage.getPhoto(item.photoStoreId);
      if (stored?.dataUrl) photoData = stored.dataUrl;
    }

    if (photoData && photoData.startsWith('data:')) {
      try {
        const uploaded = await uploadPhotoPair(photoData, thumbData || photoData, payload.tag_name || 'tag');
        payload.photo_url = uploaded.photoUrl;
        payload.photo_thumbnail_url = uploaded.thumbnailUrl;
      } catch (e) {
        console.warn('[SyncService] Storage upload notice during tag sync:', e);
      }
    }

    const { data: user } = await supabase.auth.getUser();

    // If BLE was used (device_uid is present), insert raw reading into sensor_data FIRST
    if (payload.device_uid && !payload.sensor_data_id) {
      try {
        const { data: sRec, error: sErr } = await supabase
          .from('sensor_data')
          .insert([{
            device_uid: payload.device_uid,
            ammonia: payload.ammonia,
            temperature: payload.temperature,
            humidity: payload.humidity,
            battery: payload.battery,
            latitude: payload.latitude,
            longitude: payload.longitude,
            submitted_by: user.user?.id || null,
          }])
          .select('id')
          .maybeSingle();

        if (!sErr && sRec?.id) {
          payload.sensor_data_id = sRec.id;
        } else if (sErr) {
          console.warn('[SyncService] sensor_data insert notice, continuing with sensor_data_id = null:', sErr.message);
          payload.sensor_data_id = null;
        }
      } catch (err) {
        console.warn('[SyncService] Failed to insert raw sensor reading:', err);
        payload.sensor_data_id = null;
      }
    }

    const tagRecord: any = {
      ...payload,
      offline_temp_id: temp_id || payload.offline_temp_id || null,
      created_by: user.user?.id,
    };

    let { error } = await supabase
      .from('inspection_tags')
      .insert([tagRecord]);

    // Resilient FK retry handling:
    if (error && (error.code === '23503' || error.code === '22P02')) {
      console.warn('[SyncService] FK constraint error on tag sync — retrying with safe fallbacks:', error.message);
      for (const fk of ['sensor_data_id', 'inspection_site_id', 'device_uid'] as const) {
        if (error && tagRecord[fk]) {
          tagRecord[fk] = null;
          const res = await supabase.from('inspection_tags').insert([tagRecord]);
          error = res.error;
        }
      }
      if (error) {
        const res = await supabase.from('inspection_tags').insert([{
          ...tagRecord,
          inspection_schedule_id: null,
          inspection_site_id: null,
          device_uid: null,
          sensor_data_id: null,
        }]);
        error = res.error;
      }
    }

    if (error && error.code === '23505') {
      console.warn('[SyncService] Duplicate tag detected during sync, treating as success.');
      error = null;
    }

    if (error) throw new Error(`inspection_tags insert error: ${error.message}`);
    if (temp_id) offlineStorage.removeOfflineTag(temp_id);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('tags_updated'));
  }

  /**
   * Ensure a device exists in the devices table.
   * - If it already exists: update last_seen_at.
   * - If it doesn't: auto-register it with minimal fields.
   */
  private async ensureDeviceExists(deviceUid: string): Promise<void> {
    try {
      const { data: existing } = await supabase
        .from('devices')
        .select('device_uid')
        .eq('device_uid', deviceUid)
        .maybeSingle();

      if (existing) {
        // Device found — just refresh last_seen_at
        await supabase
          .from('devices')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('device_uid', deviceUid);
        return;
      }

      // Device not found — auto-register with available columns
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id ?? null;
      const now = new Date().toISOString();

      let { error } = await supabase.from('devices').insert({
        device_uid: deviceUid,
        device_name: `Sensor ${deviceUid.slice(-6)}`,
        status: 'ACTIVE',
        first_seen_at: now,
        last_seen_at: now,
        created_by: userId,
      });

      // Fallback: minimal insert if extended columns don't exist yet
      if (error) {
        const { error: fbErr } = await supabase.from('devices').insert({
          device_uid: deviceUid,
          status: 'ACTIVE',
        });
        if (fbErr) {
          console.warn('[SyncService] Device auto-register notice:', fbErr.message);
        }
      } else {
        console.log('[SyncService] ✅ Device auto-registered:', deviceUid);
      }
    } catch (err: any) {
      // Non-fatal: log and continue — sensor_data insert may still succeed if device was
      // registered by another concurrent request.
      console.warn('[SyncService] ensureDeviceExists notice:', err?.message);
    }
  }

  private async uploadDataUrlToSupabase(dataUrl: string): Promise<string | null> {
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();

      const fileName = `offline_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
      const filePath = `user_submissions/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('inspection-photos')
        .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) {
        console.error('[SyncService] Storage upload error:', uploadError.message);
        return null;
      }

      const signedUrl = await getSignedPhotoUrl('inspection-photos', filePath);
      return signedUrl || null;
    } catch (err) {
      console.error('[SyncService] Error uploading photo blob:', err);
      return null;
    }
  }
}

export const syncService = new SyncService();
export default syncService;
