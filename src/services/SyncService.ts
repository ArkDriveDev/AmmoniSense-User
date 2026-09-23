// SyncService.ts
// Handles auto-syncing of IndexedDB queued items when back online, with retry logic.

import offlineStorage, { QueueItem } from './OfflineStorageService';
import { supabase } from './supabase';
import { registerSiteWithPhoto } from './siteService';

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

  public async syncAll(): Promise<{ success: number; failed: number }> {
    if (!this.onlineStatus || this.isSyncing) {
      return { success: 0, failed: 0 };
    }

    this.isSyncing = true;
    let successCount = 0;
    let failedCount = 0;

    try {
      const queue = await offlineStorage.getQueue();
      const pendingItems = queue.filter((item) => item.status !== 'failed' || item.retryCount < 3);

      if (pendingItems.length === 0) {
        this.isSyncing = false;
        this.notifyListeners('sync_complete');
        return { success: 0, failed: 0 };
      }

      this.notifyListeners('sync_start');

      for (const item of pendingItems) {
        if (!this.onlineStatus) break; // Network lost mid-sync

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
    // Delegate to registerSiteWithPhoto which writes to inspection_sites (renamed from monitoring_sites)
    try {
      await registerSiteWithPhoto(item.payload);
    } catch (error: any) {
      throw new Error(`inspection_sites insert error: ${error.message}`);
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
        .from('sensor-photos')
        .upload(filePath, blob, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) {
        console.error('[SyncService] Storage upload error:', uploadError.message);
        return null;
      }

      const { data: urlData } = supabase.storage
        .from('sensor-photos')
        .getPublicUrl(filePath);

      return urlData?.publicUrl || null;
    } catch (err) {
      console.error('[SyncService] Error uploading photo blob:', err);
      return null;
    }
  }
}

export const syncService = new SyncService();
export default syncService;
