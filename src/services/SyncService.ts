// SyncService.ts
// Handles auto-syncing of IndexedDB queued items when back online, with retry logic.

import offlineStorage, { QueueItem } from './OfflineStorageService';
import { supabase } from './supabase';
import { registerSiteWithPhoto } from './siteService';
import { uploadTagPhoto, getSignedPhotoUrl } from './photoStorageService';
import { calculateAmmoniaStatus } from '../types/inspection';
import { dataUrlToBlob } from '../utils/thumbnailUtils';

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
        'inspection_site': 1,
        'SITE_REGISTRATION': 1,
        'inspection_schedule': 2,
        'INSPECTION_SCHEDULE': 2,
        'inspection_tag': 3,
        'INSPECTION_TAG': 3,
        'sensor_data': 4,
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
      case 'sensor_data':
      case 'SENSOR_READING':
        await this.syncSensorReading(item);
        break;

      case 'inspection_site':
      case 'SITE_REGISTRATION':
        await this.syncSiteRegistration(item);
        break;

      case 'DEVICE_TAG':
        await this.syncDeviceTag(item);
        break;

      case 'inspection_schedule':
      case 'INSPECTION_SCHEDULE':
        await this.syncInspectionSchedule(item);
        break;

      case 'inspection_tag':
      case 'INSPECTION_TAG':
        await this.syncInspectionTag(item);
        break;

      default:
        throw new Error(`Unknown queue item type: ${item.type}`);
    }
  }

  private async syncSensorReading(item: QueueItem): Promise<void> {
    const payload = { ...(item.data || item.payload) };

    if (item.action === 'update') {
      const targetId = item.targetId || payload.id;
      if (!targetId) throw new Error('Cannot update sensor_data: targetId is required');
      const { id: _id, created_at: _ca, ...updFields } = payload;
      const { error: updErr } = await supabase
        .from('sensor_data')
        .update(updFields)
        .eq('id', targetId);
      if (updErr) throw new Error(`sensor_data update error: ${updErr.message}`);
      return;
    }

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

    // Retry without inspection_site_id if column missing from schema cache
    if (error && (
      error.message?.includes('inspection_site_id') ||
      error.code === '42703' ||
      error.code === 'PGRST204'
    )) {
      const { inspection_site_id: _s, ...minPayload } = payload;
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
  }

  private async syncSiteRegistration(item: QueueItem): Promise<void> {
    const payload = item.data || item.payload;
    if (item.action === 'update') {
      let targetId = item.targetId || payload?.id;
      if (typeof targetId === 'string' && targetId.startsWith('temp_')) {
        const map = JSON.parse(localStorage.getItem('tempIdMap') || '{}');
        targetId = map[targetId] || targetId;
      }
      if (!targetId || (typeof targetId === 'string' && targetId.startsWith('temp_'))) {
        throw new Error(`Cannot update site: real DB id missing for target ${targetId}`);
      }
      // Ensure only valid inspection_sites columns are updated
      const siteUpdates: Record<string, any> = {};
      if (payload.site_code !== undefined) siteUpdates.site_code = payload.site_code;
      if (payload.site_name !== undefined) siteUpdates.site_name = payload.site_name;
      if (payload.site_type !== undefined) siteUpdates.site_type = payload.site_type;
      if (payload.address !== undefined) siteUpdates.address = payload.address;
      if (payload.area_size_hectares !== undefined) siteUpdates.area_size_hectares = payload.area_size_hectares;
      if (payload.notes !== undefined) siteUpdates.notes = payload.notes;
      if (payload.is_active !== undefined) siteUpdates.is_active = payload.is_active;
      if (payload.site_photo_url !== undefined) siteUpdates.site_photo_url = payload.site_photo_url;
      if (payload.site_photo_thumbnail !== undefined) siteUpdates.site_photo_thumbnail = payload.site_photo_thumbnail;
      if (payload.site_photo_storage_path !== undefined) siteUpdates.site_photo_storage_path = payload.site_photo_storage_path;
      if (payload.site_photo_thumbnail_storage_path !== undefined) siteUpdates.site_photo_thumbnail_storage_path = payload.site_photo_thumbnail_storage_path;

      const lat = payload.current_latitude !== undefined ? payload.current_latitude : payload.latitude;
      const lng = payload.current_longitude !== undefined ? payload.current_longitude : payload.longitude;
      if (lat !== undefined) siteUpdates.current_latitude = lat;
      if (lng !== undefined) siteUpdates.current_longitude = lng;

      const { error: updErr } = await supabase
        .from('inspection_sites')
        .update(siteUpdates)
        .eq('id', targetId);
      if (updErr) throw new Error(`inspection_sites update error: ${updErr.message}`);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('site_synced'));
      return;
    }

    let regResult: any = null;
    try {
      regResult = await registerSiteWithPhoto(payload);
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
    const { temp_id, ...payload } = item.data || item.payload;

    if (item.action === 'update') {
      let targetId = item.targetId || payload.id;
      if (typeof targetId === 'string' && targetId.startsWith('temp_')) {
        const map = JSON.parse(localStorage.getItem('tempIdMap') || '{}');
        targetId = map[targetId] || targetId;
      }
      if (!targetId || (typeof targetId === 'string' && targetId.startsWith('temp_'))) {
        throw new Error(`Cannot update schedule: real DB id missing for target ${targetId}`);
      }
      const { id: _id, tags_count: _tc, created_at: _ca, ...schedUpdates } = payload;
      const { error: updErr } = await supabase
        .from('inspection_schedules')
        .update(schedUpdates)
        .eq('id', targetId);
      if (updErr) throw new Error(`inspection_schedules update error: ${updErr.message}`);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('schedules_updated'));
      return;
    }

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
    const { temp_id, ...payload } = item.data || item.payload;

    if (item.action === 'update') {
      let targetId = item.targetId || payload.id;
      if (typeof targetId === 'string' && targetId.startsWith('temp_')) {
        const map = JSON.parse(localStorage.getItem('tempIdMap') || '{}');
        targetId = map[targetId] || targetId;
      }
      if (!targetId || (typeof targetId === 'string' && targetId.startsWith('temp_'))) {
        throw new Error(`Cannot update tag: real DB id missing for target ${targetId}`);
      }
      const { id: _id, offline_temp_id: _otid, created_at: _ca, ...tagUpdates } = payload;
      const { error: updErr } = await supabase
        .from('inspection_tags')
        .update(tagUpdates)
        .eq('id', targetId);
      if (updErr) throw new Error(`inspection_tags update error: ${updErr.message}`);
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('tags_updated'));
      return;
    }

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

    // Validate inspection_schedule_id: check tempIdMap, fallback to offline_temp_id query, verify existence
    let scheduleId: number | null = null;
    if (typeof payload.inspection_schedule_id === 'string' && payload.inspection_schedule_id.startsWith('temp_sched_')) {
      const tempSchedId = payload.inspection_schedule_id;
      try {
        const map = JSON.parse(localStorage.getItem('tempIdMap') || '{}');
        if (map[tempSchedId]) scheduleId = Number(map[tempSchedId]) || null;
      } catch { /* ignore parse errors */ }

      if (!scheduleId) {
        const { data: sched } = await supabase
          .from('inspection_schedules')
          .select('id')
          .eq('offline_temp_id', tempSchedId)
          .maybeSingle();
        if (sched?.id) scheduleId = sched.id;
      }
    } else if (payload.inspection_schedule_id && !isNaN(Number(payload.inspection_schedule_id))) {
      scheduleId = Number(payload.inspection_schedule_id);
    }

    if (scheduleId) {
      const { data: schedule } = await supabase
        .from('inspection_schedules')
        .select('id')
        .eq('id', scheduleId)
        .maybeSingle();
      if (!schedule) {
        console.warn('[SYNC] Schedule missing, nulling schedule_id:', scheduleId);
        scheduleId = null;
      }
    }
    payload.inspection_schedule_id = scheduleId;

    // Validate inspection_site_id: check tempIdMap, verify existence in inspection_sites
    let siteId: number | null = null;
    if (typeof payload.inspection_site_id === 'string' && payload.inspection_site_id.startsWith('temp_')) {
      const mappings = JSON.parse(localStorage.getItem('tempIdMap') || '{}');
      payload.inspection_site_id = mappings[payload.inspection_site_id] || null;
    }
    if (payload.inspection_site_id && !isNaN(Number(payload.inspection_site_id))) {
      siteId = Number(payload.inspection_site_id);
    }
    if (siteId) {
      const { data: site } = await supabase
        .from('inspection_sites')
        .select('id')
        .eq('id', siteId)
        .maybeSingle();
      if (!site) {
        console.warn('[SYNC] Site missing, nulling site_id:', siteId);
        siteId = null;
      }
    }
    payload.inspection_site_id = siteId;

    let photoData = payload.photo_url;
    let thumbData = payload.photo_thumbnail_url;
    if (item.photoStoreId && (!photoData || photoData.startsWith('data:'))) {
      const stored = await offlineStorage.getPhoto(item.photoStoreId);
      if (stored?.dataUrl) photoData = stored.dataUrl;
    }



    const { data: user } = await supabase.auth.getUser();

    // Step 1: Always create a sensor_data row (readings live ONLY in sensor_data)
    let sensorDataId: number | null = payload.sensor_data_id ? Number(payload.sensor_data_id) : null;
    if (!sensorDataId) {
      try {
        const devUid = payload.device_uid || 'MANUAL-ENTRY';
        await this.ensureDeviceExists(devUid);

        const { data: sRec, error: sErr } = await supabase
          .from('sensor_data')
          .insert([{
            device_uid: devUid,
            ammonia: Number(payload.ammonia) || 0,
            temperature: Number(payload.temperature) || 0,
            humidity: Number(payload.humidity) || 0,
            battery: payload.battery !== undefined && payload.battery !== null ? Number(payload.battery) : 100,
            latitude: payload.latitude !== undefined && payload.latitude !== null ? Number(payload.latitude) : null,
            longitude: payload.longitude !== undefined && payload.longitude !== null ? Number(payload.longitude) : null,
            status: calculateAmmoniaStatus(payload.ammonia ?? 0),
            submitted_by: payload.created_by || user.user?.id || null,
          }])
          .select('id')
          .single();

        if (!sErr && sRec?.id) {
          sensorDataId = sRec.id;
        } else if (sErr) {
          console.warn('[SYNC] sensor_data insert failed, tag will have no reading link:', sErr.message);
        }
      } catch (err: any) {
        console.warn('[SYNC] Failed to insert raw sensor reading:', err?.message);
      }
    }

    // Step 2: Save tag WITHOUT reading values
    const tagRecord: any = {
      tag_name: (payload.tag_name || 'TAG').toUpperCase(),
      inspection_schedule_id: payload.inspection_schedule_id || null,
      inspection_site_id: payload.inspection_site_id || null,
      sensor_data_id: sensorDataId,
      device_uid: payload.device_uid || null,
      latitude: payload.latitude !== undefined && payload.latitude !== null ? Number(payload.latitude) : null,
      longitude: payload.longitude !== undefined && payload.longitude !== null ? Number(payload.longitude) : null,
      photo_url: payload.photo_url || null,
      photo_thumbnail_url: payload.photo_thumbnail_url || null,
      photo_storage_path: payload.photo_storage_path || null,
      photo_thumbnail_storage_path: payload.photo_thumbnail_storage_path || null,
      notes: payload.notes?.toUpperCase() || null,
      offline_temp_id: temp_id || payload.offline_temp_id || null,
      created_by: payload.created_by || user.user?.id || null,
    };

    console.log('[SYNC] Final payload:', {
      site_id: tagRecord.inspection_site_id,
      schedule_id: tagRecord.inspection_schedule_id,
      device_uid: tagRecord.device_uid,
      sensor_data_id: tagRecord.sensor_data_id,
    });

    let { data: newTagData, error } = await supabase
      .from('inspection_tags')
      .insert([tagRecord])
      .select('id')
      .maybeSingle();

    // Resilient FK retry fallback if any unexpected constraint fires
    if (error && (error.code === '23503' || error.code === '22P02')) {
      console.warn('[SYNC] FK constraint notice on tag sync — retrying with null parent FKs:', error.message);
      const res = await supabase.from('inspection_tags').insert([{
        ...tagRecord,
        inspection_schedule_id: null,
        inspection_site_id: null,
        device_uid: null,
        sensor_data_id: null,
      }]).select('id').maybeSingle();
      error = res.error;
      newTagData = res.data;
    }

    if (error && error.code === '23505') {
      console.warn('[SYNC] Duplicate tag detected during sync, treating as success.');
      error = null;
    }

    if (error) {
      console.error('[SYNC] Tag insert failed:', error);
      throw error;
    }

    // Post-insert upload photo using the numeric tag ID
    if (newTagData?.id && photoData && photoData.startsWith('data:') && tagRecord.inspection_site_id) {
      try {
        const photoBlob = dataUrlToBlob(photoData);
        const thumbBlob = thumbData && thumbData.startsWith('data:') ? dataUrlToBlob(thumbData) : null;
        const uploaded = await uploadTagPhoto(photoBlob, thumbBlob, newTagData.id, tagRecord.inspection_site_id);
        await supabase.from('inspection_tags').update({
          photo_url: uploaded.photo_url,
          photo_thumbnail_url: uploaded.photo_thumbnail_url,
          photo_storage_path: uploaded.photo_storage_path,
          photo_thumbnail_storage_path: uploaded.photo_thumbnail_storage_path,
        }).eq('id', newTagData.id);
      } catch (uploadErr) {
        console.warn('[SyncService] Post-insert photo upload failed during sync:', uploadErr);
      }
    }

    console.log('[SYNC] ✅ Tag saved');
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
