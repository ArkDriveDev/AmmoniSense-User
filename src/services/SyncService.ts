// SyncService.ts
// Handles auto-syncing of IndexedDB queued items when back online, with retry logic.

import offlineStorage, { QueueItem } from './OfflineStorageService';
import { supabase } from './supabase';
import { registerSiteWithPhoto } from './siteService';
import { uploadTagPhoto, getSignedPhotoUrl } from './photoStorageService';
import { calculateAmmoniaStatus } from '../types/inspection';
import { dataUrlToBlob } from '../utils/thumbnailUtils';
import { showToast } from '../utils/toast';

export type SyncEventType = 'status_change' | 'sync_start' | 'sync_progress' | 'sync_complete' | 'sync_error';
export type SyncEventListener = (event: { type: SyncEventType; isOnline: boolean; pendingCount: number; activeItem?: QueueItem; message?: string }) => void;

export function resolveTempId(tempId: string | null | undefined): number | null {
  if (!tempId) return null;
  const raw = String(tempId);
  try {
    const map = JSON.parse(localStorage.getItem('tempIdMap') || '{}');
    const candidates = [
      raw,
      raw.replace(/^temp_site_/, 'temp_'),
      raw.replace(/^temp_sched_/, 'temp_'),
      raw.replace(/^temp_tag_/, 'temp_'),
      raw.replace(/^temp_/, ''),
    ];
    for (const key of candidates) {
      if (map[key]) return Number(map[key]);
    }
  } catch { /* ignore */ }
  return null;
}

export function canonicalTempKey(v: unknown): string {
  if (v === null || v === undefined) return '';
  let s = String(v).trim();
  s = s.replace(/^temp_site_/, '')
       .replace(/^temp_sched_/, '')
       .replace(/^temp_tag_/, '')
       .replace(/^temp_/, '');
  return s.toLowerCase();
}

class SyncService {
  private onlineStatus: boolean = navigator.onLine;
  private isSyncing: boolean = false;
  private listeners: Set<SyncEventListener> = new Set();

  constructor() {
    this.initNetworkListeners();
    this.initQueueListeners();
  }

  private initNetworkListeners() {
    window.addEventListener('online', () => {
      console.log('📶 Network status: ONLINE');
      this.onlineStatus = true;
      this.notifyListeners('status_change');
    });

    window.addEventListener('offline', () => {
      console.log('📡 Network status: OFFLINE');
      this.onlineStatus = false;
      this.notifyListeners('status_change');
    });
  }

  private initQueueListeners() {
    if (typeof window !== 'undefined') {
      window.addEventListener('sync_queue_changed', () => {
        this.notifyQueueChanged();
      });
    }
  }

  public notifyQueueChanged(): void {
    this.notifyListeners('status_change');
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
    const result = await this.syncAll({ silent: true });
    return result;
  }

  public async syncAll(options?: { silent?: boolean }): Promise<{ success: number; failed: number }> {
    if (!this.onlineStatus || this.isSyncing) {
      return { success: 0, failed: 0 };
    }

    this.isSyncing = true;
    let successCount = 0;
    let failedCount = 0;
    const syncedTypes = new Set<'site' | 'schedule' | 'tag'>();

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

      const failedTempIds = new Set<string>();

      for (const item of pendingItems) {
        if (!this.onlineStatus) break; // Network lost mid-sync

        // If parent item failed in this sync run, keep child local without pushing
        const p = item.payload || item.data || {};
        const siteParent = canonicalTempKey(p.inspection_site_id);
        const schedParent = canonicalTempKey(p.inspection_schedule_id);
        const tagParent = canonicalTempKey(p.inspection_tag_temp_id);

        if (
          (siteParent && failedTempIds.has(siteParent)) ||
          (schedParent && failedTempIds.has(schedParent)) ||
          (tagParent && failedTempIds.has(tagParent))
        ) {
          console.warn(`[SYNC] Skipping ${item.type} (${item.id}) — parent failed this run.`);
          // IMPORTANT: mark as pending (not failed) so it retries next Sync Now
          await offlineStorage.updateQueueItemStatus(item.id, 'pending');
          continue;
        }

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
          if (item.type === 'inspection_site' || item.type === 'SITE_REGISTRATION') syncedTypes.add('site');
          if (item.type === 'inspection_schedule' || item.type === 'INSPECTION_SCHEDULE') syncedTypes.add('schedule');
          if (item.type === 'inspection_tag' || item.type === 'INSPECTION_TAG') syncedTypes.add('tag');
        } catch (err: any) {
          const sanitizedPayload = { ...p };
          for (const key of Object.keys(sanitizedPayload)) {
            if (
              (key.includes('photo') || key.includes('thumbnail')) &&
              typeof sanitizedPayload[key] === 'string' &&
              sanitizedPayload[key].length > 100
            ) {
              sanitizedPayload[key] = '[REDACTED_IMAGE_DATA]';
            }
          }
          console.error(`[SYNC FAILURE] Item ${item.id} (${item.type}) failed:`, {
            error: err?.message || err,
            tempId: item.tempId || p.temp_id || p.offline_temp_id,
            targetId: item.targetId,
            payload: sanitizedPayload,
          });
          failedCount++;
          const errorMsg = err?.message || (typeof err === 'string' ? err : 'Sync failed');
          if (item.tempId) failedTempIds.add(canonicalTempKey(item.tempId));
          if (p.temp_id) failedTempIds.add(canonicalTempKey(p.temp_id));
          if (p.offline_temp_id) failedTempIds.add(canonicalTempKey(p.offline_temp_id));
          if (p.inspection_tag_temp_id) failedTempIds.add(canonicalTempKey(p.inspection_tag_temp_id));
          if (p.inspection_schedule_id) failedTempIds.add(canonicalTempKey(p.inspection_schedule_id));
          if (p.inspection_site_id) failedTempIds.add(canonicalTempKey(p.inspection_site_id));
          await offlineStorage.updateQueueItemStatus(item.id, 'failed', errorMsg);
          this.notifyListeners('sync_error', item, errorMsg);
        }
      }
    } finally {
      this.isSyncing = false;
      this.notifyListeners('sync_complete');
      if (typeof window !== 'undefined') {
        if (syncedTypes.has('site')) {
          window.dispatchEvent(new CustomEvent('site_synced'));
          window.dispatchEvent(new CustomEvent('sites_updated'));
        }
        if (syncedTypes.has('schedule')) {
          window.dispatchEvent(new CustomEvent('schedules_updated'));
        }
        if (syncedTypes.has('tag')) {
          window.dispatchEvent(new CustomEvent('tags_updated'));
        }
      }
      if (!options?.silent && successCount > 0) {
        showToast({
          message: `🎉 Auto-sync complete: ${successCount} offline item(s) synchronized!`,
          color: 'success',
        });
      }
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

    // 1. Ensure device exists in devices table before inserting sensor_data
    const deviceUid = payload.device_uid;
    if (!deviceUid || typeof deviceUid !== 'string' || deviceUid.trim() === '') {
      throw new Error(
        `Cannot sync reading: missing device_uid (temp_tag ${payload.inspection_tag_temp_id || 'unknown'})`
      );
    }
    await this.ensureDeviceExists(deviceUid);

    // Resolve inspection_tag_id if inspection_tag_temp_id is present
    if (!payload.inspection_tag_id && payload.inspection_tag_temp_id) {
      const resolvedTagId = resolveTempId(payload.inspection_tag_temp_id);
      if (resolvedTagId) {
        payload.inspection_tag_id = resolvedTagId;
      } else {
        const { data: tagRow } = await supabase
          .from('inspection_tags')
          .select('id')
          .eq('offline_temp_id', payload.inspection_tag_temp_id)
          .maybeSingle();
        if (tagRow?.id) {
          payload.inspection_tag_id = tagRow.id;
        } else {
          const altId = payload.inspection_tag_temp_id.startsWith('temp_tag_')
            ? payload.inspection_tag_temp_id.replace(/^temp_tag_/, '')
            : `temp_tag_${payload.inspection_tag_temp_id}`;
          const { data: altTag } = await supabase
            .from('inspection_tags')
            .select('id')
            .eq('offline_temp_id', altId)
            .maybeSingle();
          if (altTag?.id) payload.inspection_tag_id = altTag.id;
        }

        if (payload.inspection_tag_id) {
          try {
            const map = JSON.parse(localStorage.getItem('tempIdMap') || '{}');
            map[payload.inspection_tag_temp_id] = payload.inspection_tag_id;
            localStorage.setItem('tempIdMap', JSON.stringify(map));
          } catch { /* ignore */ }
        }
      }
    }

    if (!payload.inspection_tag_id && payload.inspection_tag_temp_id) {
      throw new Error(`Cannot sync reading: parent tag "${payload.inspection_tag_temp_id}" has no offline_temp_id in Supabase — was the tag synced?`);
    }

    const { data: userData } = await supabase.auth.getUser();
    const currentUserId = userData?.user?.id || null;

    // 2. Normalize parsed payload → real columns (strict whitelist)
    const rawAmmonia = Number(payload.nh3_ppm ?? payload.ammonia ?? 0);
    const rawBattery = payload.battery_percent ?? payload.battery;
    const sensorRecord: Record<string, any> = {
      device_uid: deviceUid,
      ammonia: rawAmmonia,
      temperature: payload.temperature !== undefined && payload.temperature !== null
        ? Number(payload.temperature) : null,
      humidity: payload.humidity !== undefined && payload.humidity !== null
        ? Number(payload.humidity) : null,
      battery: rawBattery !== undefined && rawBattery !== null
        ? Number(rawBattery) : null,
      status: payload.status || calculateAmmoniaStatus(rawAmmonia),
      submitted_by: payload.submitted_by ?? payload.created_by ?? currentUserId ?? null,
      session_id: payload.session_id || null,
      inspection_tag_id: payload.inspection_tag_id || null,
      inspection_tag_temp_id: payload.inspection_tag_temp_id || null,
    };

    const { data: inserted, error } = await supabase
      .from('sensor_data')
      .insert([sensorRecord])
      .select('id')
      .maybeSingle();

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
      if (payload.poultry_type !== undefined) siteUpdates.poultry_type = payload.poultry_type;
      if (payload.chicken_type !== undefined) siteUpdates.chicken_type = payload.chicken_type;
      if (payload.address !== undefined) siteUpdates.address = payload.address;
      if (payload.area_size_hectares !== undefined) siteUpdates.area_size_hectares = payload.area_size_hectares;
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
      return;
    }

    let regResult: any = null;
    try {
      regResult = await registerSiteWithPhoto(payload);
    } catch (error: any) {
      throw new Error(`inspection_sites insert error: ${error.message}`);
    }

    const tempId = item.payload?.temp_id || item.payload?.offline_temp_id || item.tempId || item.payload?.id;
    let realSiteId = regResult?.site?.id;

    if (!realSiteId && item.payload?.site_code) {
      try {
        const { data: foundSite } = await supabase
          .from('inspection_sites')
          .select('id')
          .eq('site_code', item.payload.site_code)
          .maybeSingle();
        if (foundSite?.id) realSiteId = foundSite.id;
      } catch (e) {
        console.warn('[SyncService] Could not fetch real site ID by site_code:', e);
      }
    }

    if (realSiteId) {
      try {
        const map = JSON.parse(localStorage.getItem('tempIdMap') || '{}');
        if (tempId) map[tempId] = realSiteId;
        if (item.tempId) map[item.tempId] = realSiteId;
        if (item.payload?.temp_id) map[item.payload.temp_id] = realSiteId;
        if (item.payload?.offline_temp_id) map[item.payload.offline_temp_id] = realSiteId;
        if (item.payload?.site_code) map[item.payload.site_code] = realSiteId;
        localStorage.setItem('tempIdMap', JSON.stringify(map));
      } catch (e) {
        console.warn('[SyncService] Could not save site tempIdMap:', e);
      }

      try {
        const allItems = await offlineStorage.getQueue();
        for (const qi of allItems) {
          if (String(qi.payload?.inspection_site_id) === String(tempId)) {
            qi.payload.inspection_site_id = realSiteId;
            await offlineStorage.updateQueueItemPayload(qi.id, qi.payload);
          }
        }
      } catch (e) {
        console.warn('[SyncService] Could not patch queued items with real site ID:', e);
      }

      try {
        const offlineScheds = offlineStorage.getOfflineSchedules();
        let changed = false;
        offlineScheds.forEach((sched: any) => {
          if (String(sched.inspection_site_id) === String(tempId)) {
            sched.inspection_site_id = realSiteId;
            changed = true;
          }
        });
        if (changed) {
          localStorage.setItem('offline_inspection_schedules', JSON.stringify(offlineScheds));
        }
      } catch (e) {
        console.warn('[SyncService] Could not patch offline schedules with real site ID:', e);
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
  }

  private async syncDeviceTag(item: QueueItem): Promise<void> {
    const { error } = await supabase.from('devices').insert([item.payload]);
    if (error) {
      throw new Error(`devices insert error: ${error.message}`);
    }
  }

  private async syncInspectionSchedule(item: QueueItem): Promise<void> {
    const { temp_id, ...payload } = item.data || item.payload;

    const allowedScheduleFields = [
      'inspection_site_id',
      'schedule_name',
      'scheduled_date',
      'scheduled_time',
      'status',
      'started_at',
      'completed_at',
      'notes',
    ];

    if (item.action === 'update') {
      let targetId = item.targetId || payload.id;
      if (typeof targetId === 'string' && targetId.startsWith('temp_')) {
        const map = JSON.parse(localStorage.getItem('tempIdMap') || '{}');
        targetId = map[targetId] || targetId;
      }
      if (!targetId || (typeof targetId === 'string' && targetId.startsWith('temp_'))) {
        throw new Error(`Cannot update schedule: real DB id missing for target ${targetId}`);
      }
      const schedUpdates: Record<string, any> = {};
      for (const key of allowedScheduleFields) {
        if (payload[key] !== undefined) schedUpdates[key] = payload[key];
      }
      const { error: updErr } = await supabase
        .from('inspection_schedules')
        .update(schedUpdates)
        .eq('id', targetId);
      if (updErr) throw new Error(`inspection_schedules update error: ${updErr.message}`);
      return;
    }

    // Resolve temp site ID → real BIGINT id before inserting
    if (typeof payload.inspection_site_id === 'string' && (payload.inspection_site_id.startsWith('temp_') || isNaN(Number(payload.inspection_site_id)))) {
      const tempSiteId = payload.inspection_site_id;
      const resolvedSiteId = resolveTempId(tempSiteId);
      if (resolvedSiteId) payload.inspection_site_id = resolvedSiteId;

      if (typeof payload.inspection_site_id === 'string' && (payload.inspection_site_id.startsWith('temp_') || isNaN(Number(payload.inspection_site_id)))) {
        const { data: site } = await supabase
          .from('inspection_sites')
          .select('id')
          .eq('offline_temp_id', tempSiteId)
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

    if (typeof payload.inspection_site_id === 'string' && (payload.inspection_site_id.startsWith('temp_') || isNaN(Number(payload.inspection_site_id)))) {
      throw new Error(`Cannot sync schedule: parent site "${payload.inspection_site_id}" has no offline_temp_id in Supabase — was the site synced?`);
    }

    const { data: user } = await supabase.auth.getUser();

    const scheduleRecord: Record<string, any> = {};
    for (const key of allowedScheduleFields) {
      if (payload[key] !== undefined) scheduleRecord[key] = payload[key];
    }
    scheduleRecord.offline_temp_id = temp_id || null;
    scheduleRecord.created_by = user.user?.id || null;

    const { data: inserted, error } = await supabase
      .from('inspection_schedules')
      .insert([scheduleRecord])
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
  }

  private async syncInspectionTag(item: QueueItem): Promise<void> {
    const { temp_id, ...payload } = item.data || item.payload;

    const allowedTagFields = [
      'tag_name', 'inspection_schedule_id', 'latitude', 'longitude',
      'photo_url', 'photo_thumbnail_url', 'notes', 'violation_category',
      'offline_temp_id', 'created_by',
    ];

    if (item.action === 'update') {
      let targetId = item.targetId || payload.id;
      if (typeof targetId === 'string' && targetId.startsWith('temp_')) {
        const map = JSON.parse(localStorage.getItem('tempIdMap') || '{}');
        targetId = map[targetId] || targetId;
      }
      if (!targetId || (typeof targetId === 'string' && targetId.startsWith('temp_'))) {
        throw new Error(`Cannot update tag: real DB id missing for target ${targetId}`);
      }
      const tagUpdates: Record<string, any> = {};
      for (const key of allowedTagFields) {
        if (payload[key] !== undefined && key !== 'offline_temp_id' && key !== 'created_by') {
          tagUpdates[key] = payload[key];
        }
      }
      const { error: updErr } = await supabase
        .from('inspection_tags')
        .update(tagUpdates)
        .eq('id', targetId);
      if (updErr) throw new Error(`inspection_tags update error: ${updErr.message}`);
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


    // Validate inspection_schedule_id: check tempIdMap, fallback to offline_temp_id query, verify existence
    let scheduleId: number | null = null;
    const resolvedSchedId = resolveTempId(payload.inspection_schedule_id);
    if (resolvedSchedId) {
      scheduleId = resolvedSchedId;
    } else if (typeof payload.inspection_schedule_id === 'string' && (payload.inspection_schedule_id.startsWith('temp_') || isNaN(Number(payload.inspection_schedule_id)))) {
      const tempSchedId = payload.inspection_schedule_id;
      const { data: sched } = await supabase
        .from('inspection_schedules')
        .select('id')
        .eq('offline_temp_id', tempSchedId)
        .maybeSingle();
      if (sched?.id) {
        scheduleId = sched.id;
        try {
          const map = JSON.parse(localStorage.getItem('tempIdMap') || '{}');
          map[tempSchedId] = sched.id;
          localStorage.setItem('tempIdMap', JSON.stringify(map));
        } catch { /* ignore */ }
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
        throw new Error(`Cannot sync tag: schedule ID ${scheduleId} not found in Supabase.`);
      }
    } else if (payload.inspection_schedule_id) {
      throw new Error(`Cannot sync tag: parent schedule ${payload.inspection_schedule_id} has no offline_temp_id in Supabase — was the schedule synced?`);
    }
    payload.inspection_schedule_id = scheduleId;

    // Validate inspection_site_id: check tempIdMap, fallback to offline_temp_id query, verify existence in inspection_sites
    let siteId: number | null = null;
    const resolvedSiteId = resolveTempId(payload.inspection_site_id);
    if (resolvedSiteId) {
      payload.inspection_site_id = resolvedSiteId;
      siteId = resolvedSiteId;
    } else if (typeof payload.inspection_site_id === 'string' && (payload.inspection_site_id.startsWith('temp_') || isNaN(Number(payload.inspection_site_id)))) {
      const tempSiteId = payload.inspection_site_id;
      const { data: site } = await supabase
        .from('inspection_sites')
        .select('id')
        .eq('offline_temp_id', tempSiteId)
        .maybeSingle();
      if (site?.id) {
        siteId = site.id;
        payload.inspection_site_id = site.id;
        try {
          const map = JSON.parse(localStorage.getItem('tempIdMap') || '{}');
          map[tempSiteId] = site.id;
          localStorage.setItem('tempIdMap', JSON.stringify(map));
        } catch { /* ignore */ }
      }
    } else if (payload.inspection_site_id && !isNaN(Number(payload.inspection_site_id))) {
      siteId = Number(payload.inspection_site_id);
    }
    if (siteId) {
      const { data: site } = await supabase
        .from('inspection_sites')
        .select('id')
        .eq('id', siteId)
        .maybeSingle();
      if (!site) {
        throw new Error(`Cannot sync tag: site ID ${siteId} not found in Supabase.`);
      }
    } else if (payload.inspection_site_id) {
      throw new Error(`Cannot sync tag: parent site ${payload.inspection_site_id} has no offline_temp_id in Supabase — was the site synced?`);
    }
    payload.inspection_site_id = siteId;

    let photoData = payload.photo_url;
    let thumbData = payload.photo_thumbnail_url;
    if (item.photoStoreId && (!photoData || photoData.startsWith('data:'))) {
      const stored = await offlineStorage.getPhoto(item.photoStoreId);
      if (stored?.dataUrl) photoData = stored.dataUrl;
    }

    const { data: user } = await supabase.auth.getUser();

    // Save tag WITHOUT reading values using strict whitelist (readings exist in sensor_data via capture)
    const tagBase: Record<string, any> = {
      tag_name: (payload.tag_name || 'TAG').toUpperCase(),
      inspection_schedule_id: payload.inspection_schedule_id || null,
      latitude: payload.latitude !== undefined && payload.latitude !== null ? Number(payload.latitude) : null,
      longitude: payload.longitude !== undefined && payload.longitude !== null ? Number(payload.longitude) : null,
      photo_url: payload.photo_url || null,
      photo_thumbnail_url: payload.photo_thumbnail_url || null,
      notes: payload.notes?.toUpperCase() || null,
      violation_category: payload.violation_category || null,
      offline_temp_id: temp_id || payload.offline_temp_id || null,
      created_by: payload.created_by || user.user?.id || null,
    };

    const tagRecord: Record<string, any> = {};
    for (const key of allowedTagFields) {
      if (tagBase[key] !== undefined) tagRecord[key] = tagBase[key];
    }

    console.log('[SYNC] Final payload:', {
      schedule_id: tagRecord.inspection_schedule_id,
    });

    let { data: newTagData, error } = await supabase
      .from('inspection_tags')
      .insert([tagRecord])
      .select('id')
      .maybeSingle();

    if (error && error.code === '23505') {
      console.warn('[SYNC] Duplicate tag detected during sync, treating as success.');
      error = null;
    }

    if (error) {
      console.error('[SYNC] Tag insert failed:', error);
      throw error;
    }

    // Post-insert upload photo using the numeric tag ID
    if (newTagData?.id && photoData && photoData.startsWith('data:')) {
      try {
        let derivedSiteId: number | null = null;
        if (tagRecord.inspection_schedule_id) {
          const { data: schedRow } = await supabase
            .from('inspection_schedules')
            .select('inspection_site_id')
            .eq('id', tagRecord.inspection_schedule_id)
            .maybeSingle();
          derivedSiteId = schedRow?.inspection_site_id ?? null;
        }
        const photoBlob = dataUrlToBlob(photoData);
        const thumbBlob = thumbData && thumbData.startsWith('data:') ? dataUrlToBlob(thumbData) : null;
        const uploaded = await uploadTagPhoto(photoBlob, thumbBlob, newTagData.id, derivedSiteId);
        await supabase.from('inspection_tags').update({
          photo_url: uploaded.photo_url,
          photo_thumbnail_url: uploaded.photo_thumbnail_url,
        }).eq('id', newTagData.id);
      } catch (uploadErr) {
        console.warn('[SyncService] Post-insert photo upload failed during sync:', uploadErr);
      }
    }

    console.log('[SYNC] ✅ Tag saved');

    // Backfill inspection_tag_id on sensor_data rows matching inspection_tag_temp_id
    const effectiveTempId = temp_id || tagRecord.offline_temp_id;
    if (newTagData?.id && effectiveTempId) {
      try {
        const map = JSON.parse(localStorage.getItem('tempIdMap') || '{}');
        map[effectiveTempId] = newTagData.id;
        localStorage.setItem('tempIdMap', JSON.stringify(map));

        // Patch pending sensor_data queue items in IndexedDB with the real tag ID
        const allItems = await offlineStorage.getQueue();
        for (const qi of allItems) {
          if (qi.type === 'sensor_data' && (qi.payload?.inspection_tag_temp_id === effectiveTempId || qi.tempId === effectiveTempId)) {
            qi.payload.inspection_tag_id = newTagData.id;
            await offlineStorage.updateQueueItemPayload(qi.id, qi.payload);
          }
        }

        await supabase
          .from('sensor_data')
          .update({ inspection_tag_id: newTagData.id })
          .eq('inspection_tag_temp_id', effectiveTempId);
        console.log(`[SYNC] Backfilled inspection_tag_id ${newTagData.id} for temp_id ${effectiveTempId}`);
      } catch (bfErr) {
        console.warn('[SYNC] Backfill inspection_tag_id error:', bfErr);
      }
    }

    if (temp_id) offlineStorage.removeOfflineTag(temp_id);
  }

  /**
   * Ensure a device exists in the devices table.
   * - If it already exists: update last_seen_at.
   * - If it doesn't: auto-register it with minimal fields.
   */
  private async ensureDeviceExists(deviceUid: string): Promise<void> {
    if (!deviceUid || ['ESP32-AMMONIA-NODE-01', 'MANUAL-ENTRY', 'AmmoniSense'].includes(deviceUid.trim())) {
      console.warn(`[SyncService] Rejecting phantom device registration for: "${deviceUid}"`);
      return;
    }

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
