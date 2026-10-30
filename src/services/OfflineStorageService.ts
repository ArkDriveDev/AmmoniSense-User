// OfflineStorageService.ts
// Handles localStorage for auth session & form drafts, and IndexedDB for offline queue & photo blobs.

import { OfflineSite } from '../types/site';

export type QueueAction = 'insert' | 'update';

export type QueueItemType =
  | 'inspection_tag'
  | 'inspection_schedule'
  | 'inspection_site'
  | 'sensor_data'
  | 'SENSOR_READING'
  | 'SITE_REGISTRATION'
  | 'DEVICE_TAG'
  | 'INSPECTION_SCHEDULE'
  | 'INSPECTION_TAG';

export interface EnqueueOptions {
  action?: QueueAction;
  targetId?: number | string | null;
  tempId?: string | null;
  photoStoreId?: string;
}

export interface QueueItem {
  id: string;
  type: QueueItemType;
  action: QueueAction;
  targetId: number | string | null;
  tempId: string | null;
  data: any;
  payload: any;
  photoStoreId?: string;
  createdAt: string;
  timestamp: string;
  status: 'pending' | 'syncing' | 'failed';
  retryCount: number;
  errorMsg?: string;
}

export interface StoredPhoto {
  id: string;
  dataUrl: string;
  timestamp: string;
}

const DB_NAME = 'AmmoniSenseOfflineDB';
const DB_VERSION = 3;
const QUEUE_STORE = 'offline_queue';
const PHOTO_STORE = 'photo_store';
const OFFLINE_SITES_STORE = 'offline_sites';
const SITES_STORE = 'all_sites';
const SCHEDULES_STORE = 'all_schedules';
const TAGS_STORE = 'all_tags';

// LOCALSTORAGE KEYS
const SESSION_KEY = 'ammonisense_session';
const PROFILE_KEY = 'ammonisense_user_profile';
export const SENSOR_DRAFT_KEY = 'draft_sensor_submission';
export const SITE_DRAFT_KEY = 'draft_site_creation';

class OfflineStorageService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor() {
    this.initDB();
  }

  // Initialize IndexedDB
  private initDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(QUEUE_STORE)) {
          db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(PHOTO_STORE)) {
          db.createObjectStore(PHOTO_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(OFFLINE_SITES_STORE)) {
          db.createObjectStore(OFFLINE_SITES_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(SITES_STORE)) {
          db.createObjectStore(SITES_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(SCHEDULES_STORE)) {
          db.createObjectStore(SCHEDULES_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(TAGS_STORE)) {
          db.createObjectStore(TAGS_STORE, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  // ==========================================
  // LOCAL STORAGE HELPERS (Session & Drafts)
  // ==========================================

  saveSession(session: any, profile?: any): void {
    try {
      if (session) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      }
      if (profile) {
        localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
      }
    } catch (e) {
      console.error('Error saving session to localStorage', e);
    }
  }

  getSession(): { session: any; profile: any } | null {
    try {
      const sessionStr = localStorage.getItem(SESSION_KEY);
      const profileStr = localStorage.getItem(PROFILE_KEY);
      if (!sessionStr) return null;
      return {
        session: JSON.parse(sessionStr),
        profile: profileStr ? JSON.parse(profileStr) : null,
      };
    } catch (e) {
      console.error('Error reading session from localStorage', e);
      return null;
    }
  }

  clearSession(): void {
    try {
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(PROFILE_KEY);
    } catch (e) {
      console.error('Error clearing session from localStorage', e);
    }
  }

  saveDraft(key: string, data: any): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.error(`Error saving draft ${key}`, e);
    }
  }

  getDraft<T>(key: string): T | null {
    try {
      const draftStr = localStorage.getItem(key);
      return draftStr ? JSON.parse(draftStr) : null;
    } catch (e) {
      console.error(`Error reading draft ${key}`, e);
      return null;
    }
  }

  clearDraft(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.error(`Error clearing draft ${key}`, e);
    }
  }

  // ==========================================
  // INDEXEDDB QUEUE HELPERS
  // ==========================================

  async enqueueItem(
    type: QueueItemType,
    data: any,
    optionsOrPhotoId?: EnqueueOptions | string
  ): Promise<QueueItem> {
    const db = await this.initDB();
    const isOptionsObj = typeof optionsOrPhotoId === 'object' && optionsOrPhotoId !== null;
    const photoStoreId = typeof optionsOrPhotoId === 'string'
      ? optionsOrPhotoId
      : optionsOrPhotoId?.photoStoreId;
    const action: QueueAction = (isOptionsObj && optionsOrPhotoId.action) ? optionsOrPhotoId.action : 'insert';
    const targetId = isOptionsObj && optionsOrPhotoId.targetId !== undefined
      ? optionsOrPhotoId.targetId
      : (data?.id && !String(data?.id).startsWith('temp_') ? data.id : null);
    const tempId = isOptionsObj && optionsOrPhotoId.tempId !== undefined
      ? optionsOrPhotoId.tempId
      : (data?.temp_id || data?.offline_temp_id || (String(data?.id).startsWith('temp_') ? String(data.id) : null));
    const now = new Date().toISOString();

    const item: QueueItem = {
      id: `queue_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type,
      action,
      targetId,
      tempId,
      data,
      payload: data,
      photoStoreId,
      createdAt: now,
      timestamp: now,
      status: 'pending',
      retryCount: 0,
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.add(item);
      req.onsuccess = () => {
        this.notifyQueueChanged();
        resolve(item);
      };
      req.onerror = () => reject(req.error);
    });
  }

  private notifyQueueChanged(): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sync_queue_changed'));
    }
  }

  async getQueue(): Promise<QueueItem[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readonly');
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async removeQueueItem(id: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);
      const req = store.delete(id);
      req.onsuccess = () => {
        this.notifyQueueChanged();
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  }

  async updateQueueItemStatus(
    id: string,
    status: QueueItem['status'],
    errorMsg?: string
  ): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const item: QueueItem = getReq.result;
        if (item) {
          item.status = status;
          if (status === 'failed') {
            item.retryCount += 1;
          }
          if (errorMsg) {
            item.errorMsg = errorMsg;
          }
          const putReq = store.put(item);
          putReq.onsuccess = () => {
            this.notifyQueueChanged();
            resolve();
          };
          putReq.onerror = () => reject(putReq.error);
        } else {
          resolve();
        }
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  async updateQueueItemPayload(id: string, payload: any): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      const store = tx.objectStore(QUEUE_STORE);
      const getReq = store.get(id);

      getReq.onsuccess = () => {
        const item: QueueItem = getReq.result;
        if (item) {
          item.payload = payload;
          item.data = payload;
          const putReq = store.put(item);
          putReq.onsuccess = () => {
            this.notifyQueueChanged();
            resolve();
          };
          putReq.onerror = () => reject(putReq.error);
        } else {
          resolve();
        }
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  // ==========================================
  // INDEXEDDB PHOTO HELPERS
  // ==========================================

  async savePhoto(dataUrl: string): Promise<string> {
    const db = await this.initDB();
    const photoId = `photo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const record: StoredPhoto = {
      id: photoId,
      dataUrl,
      timestamp: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE, 'readwrite');
      const store = tx.objectStore(PHOTO_STORE);
      const req = store.add(record);
      req.onsuccess = () => resolve(photoId);
      req.onerror = () => reject(req.error);
    });
  }

  async getPhoto(id: string): Promise<StoredPhoto | null> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE, 'readonly');
      const store = tx.objectStore(PHOTO_STORE);
      const req = store.get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async removePhoto(id: string): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PHOTO_STORE, 'readwrite');
      const store = tx.objectStore(PHOTO_STORE);
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // ==========================================
  // INDEXEDDB OFFLINE SITES HELPERS & ALL SITES (SINGLE SOURCE OF TRUTH)
  // ==========================================

  async getAllSitesFromIDB(): Promise<any[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SITES_STORE, 'readonly');
      const store = tx.objectStore(SITES_STORE);
      const req = store.getAll();
      req.onsuccess = async () => {
        let list: any[] = req.result || [];
        if (list.length === 0) {
          const offline = await this.getOfflineSites().catch(() => []);
          const cached = this.getCachedSites();
          const seedMap = new Map<string, any>();
          cached.forEach((s) => seedMap.set(String(s.id), s));
          offline.forEach((s) => seedMap.set(String(s.id), { ...s, isOffline: true, offline_temp_id: s.id }));
          list = Array.from(seedMap.values());
          if (list.length > 0) {
            await this.upsertSitesToIDB(list);
          }
        }
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async upsertSitesToIDB(sites: any[]): Promise<void> {
    if (!Array.isArray(sites) || sites.length === 0) return;
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SITES_STORE, 'readwrite');
      const store = tx.objectStore(SITES_STORE);
      sites.forEach((s) => {
        const id = s.id !== undefined && s.id !== null ? s.id : s.offline_temp_id || s.temp_id;
        if (id !== undefined && id !== null) {
          store.put({ ...s, id });
        }
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteSiteFromIDB(id: string | number): Promise<void> {
    const db = await this.initDB();
    const strId = String(id);
    const numId = Number(id);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SITES_STORE, 'readwrite');
      const store = tx.objectStore(SITES_STORE);
      store.delete(strId);
      if (!isNaN(numId)) store.delete(numId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async saveOfflineSite(site: OfflineSite): Promise<OfflineSite> {
    const db = await this.initDB();
    const record = { ...site, isOffline: true, offline_temp_id: site.id };
    await this.upsertSitesToIDB([record]);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(OFFLINE_SITES_STORE, 'readwrite');
      const store = tx.objectStore(OFFLINE_SITES_STORE);
      const req = store.put(record);
      req.onsuccess = () => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sites_updated'));
        }
        resolve(record);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async getOfflineSites(): Promise<OfflineSite[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(OFFLINE_SITES_STORE, 'readonly');
      const store = tx.objectStore(OFFLINE_SITES_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async updateOfflineSite(id: string, updates: Partial<OfflineSite>): Promise<void> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(OFFLINE_SITES_STORE, 'readwrite');
      const store = tx.objectStore(OFFLINE_SITES_STORE);
      const getReq = store.get(id);

      getReq.onsuccess = async () => {
        const item: OfflineSite = getReq.result;
        if (item) {
          const updatedItem = {
            ...item,
            ...updates,
            lastModified: new Date().toISOString(),
          };
          const putReq = store.put(updatedItem);
          putReq.onsuccess = async () => {
            await this.upsertSitesToIDB([updatedItem]);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('sites_updated'));
            }
            resolve();
          };
          putReq.onerror = () => reject(putReq.error);
        } else {
          resolve();
        }
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  async deleteOfflineSite(id: string): Promise<void> {
    await this.deleteSiteFromIDB(id);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sites_updated'));
    }
    // 1. Delete from IndexedDB OFFLINE_SITES_STORE
    try {
      const db = await this.initDB();
      const tx = db.transaction(OFFLINE_SITES_STORE, 'readwrite');
      const store = tx.objectStore(OFFLINE_SITES_STORE);
      store.delete(id);
    } catch (e) {
      console.warn('IndexedDB deleteOfflineSite notice:', e);
    }

    // 2. Purge queued SITE_REGISTRATION and SENSOR_READING items matching this ID
    try {
      const queue = await this.getQueue();
      for (const item of queue) {
        const isMatchingSite =
          item.type === 'SITE_REGISTRATION' &&
          (item.payload?.temp_id === id || item.payload?.id === id || item.id === id);

        const isMatchingReading =
          item.type === 'SENSOR_READING' &&
          (item.payload?.site_id === id ||
            item.payload?.temp_id === id ||
            item.payload?.inspection_site_id === id ||
            String(item.payload?.site_id) === String(id));

        if (isMatchingSite || isMatchingReading) {
          if (item.photoStoreId) {
            try {
              const db = await this.initDB();
              const tx = db.transaction(PHOTO_STORE, 'readwrite');
              tx.objectStore(PHOTO_STORE).delete(item.photoStoreId);
            } catch (pErr) {
              console.warn('Error purging photo from PHOTO_STORE:', pErr);
            }
          }
          await this.removeQueueItem(item.id);
        }
      }
    } catch (qErr) {
      console.warn('Error purging site from offline queue:', qErr);
    }

    // 3. Purge site from localStorage 'offline_sites' key
    this.removeSiteFromLocalStorage(id);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('sync_queue_changed'));
  }

  async deleteOfflineReading(queueId: string): Promise<void> {
    try {
      const queue = await this.getQueue();
      const item = queue.find((q) => q.id === queueId);
      if (item?.photoStoreId) {
        const db = await this.initDB();
        const tx = db.transaction(PHOTO_STORE, 'readwrite');
        tx.objectStore(PHOTO_STORE).delete(item.photoStoreId);
      }
      await this.removeQueueItem(queueId);
    } catch (e) {
      console.warn('Error deleting offline reading:', e);
    }
  }

  public removeSiteFromLocalStorage(id: string): void {
    try {
      const lsStr = localStorage.getItem('offline_sites');
      if (lsStr) {
        const lsArr = JSON.parse(lsStr);
        if (Array.isArray(lsArr)) {
          const filtered = lsArr.filter((s: any) => s.id !== id && s.temp_id !== id && s.site_code !== id);
          localStorage.setItem('offline_sites', JSON.stringify(filtered));
        }
      }
      this.removeCachedSite(id);
    } catch (lsErr) {
      console.warn('Error removing site from localStorage offline_sites:', lsErr);
    }
  }

  async getAllSchedulesFromIDB(siteId?: string | number): Promise<any[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SCHEDULES_STORE, 'readonly');
      const store = tx.objectStore(SCHEDULES_STORE);
      const req = store.getAll();
      req.onsuccess = async () => {
        let list: any[] = req.result || [];
        if (list.length === 0) {
          const offline = this.getOfflineSchedules();
          if (offline.length > 0) {
            await this.upsertSchedulesToIDB(offline);
            list = offline;
          }
        }
        if (siteId) {
          const target = String(siteId);
          list = list.filter((s: any) => String(s.inspection_site_id) === target || String(s.offline_temp_id) === target);
        }
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async upsertSchedulesToIDB(schedules: any[]): Promise<void> {
    if (!Array.isArray(schedules) || schedules.length === 0) return;
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SCHEDULES_STORE, 'readwrite');
      const store = tx.objectStore(SCHEDULES_STORE);
      schedules.forEach((s) => {
        const id = s.id !== undefined && s.id !== null ? s.id : s.offline_temp_id || s.temp_id;
        if (id !== undefined && id !== null) {
          store.put({ ...s, id });
        }
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteScheduleFromIDB(id: string | number): Promise<void> {
    const db = await this.initDB();
    const strId = String(id);
    const numId = Number(id);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SCHEDULES_STORE, 'readwrite');
      const store = tx.objectStore(SCHEDULES_STORE);
      store.delete(strId);
      if (!isNaN(numId)) store.delete(numId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public getOfflineSchedules(): any[] {
    try {
      const data = localStorage.getItem('offline_inspection_schedules');
      return data ? JSON.parse(data) : [];
    } catch { return []; }
  }

  public saveOfflineSchedule(schedule: any): void {
    const list = this.getOfflineSchedules().filter((s: any) => s.id !== schedule.id);
    list.unshift(schedule);
    localStorage.setItem('offline_inspection_schedules', JSON.stringify(list));
    this.upsertSchedulesToIDB([{ ...schedule, isOffline: true, offline_temp_id: schedule.id }]).then(() => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('schedules_updated'));
      }
    });
  }

  public removeOfflineSchedule(id: string | number): void {
    const list = this.getOfflineSchedules().filter((s: any) => String(s.id) !== String(id));
    localStorage.setItem('offline_inspection_schedules', JSON.stringify(list));
    this.deleteScheduleFromIDB(id).then(() => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('schedules_updated'));
      }
    });
  }

  /**
   * Purge a schedule and all its queued tags, readings, photos, and queue records.
   */
  async deleteScheduleAndChildren(scheduleTempId: string): Promise<void> {
    const strId = String(scheduleTempId);
    try {
      const idbTags = await this.getAllTagsFromIDB({ scheduleId: strId, scheduleTempId: strId });
      const lsTags = this.getOfflineTags().filter((t: any) => String(t.inspection_schedule_id) === strId);
      const queue = await this.getQueue();
      const childTagIds = new Set<string>();
      const childSessionIds = new Set<string>();
      [...idbTags, ...lsTags].forEach((t: any) => {
        [t.id, t.offline_temp_id].filter(Boolean).forEach((v) => childTagIds.add(String(v)));
        if (t.session_id) childSessionIds.add(String(t.session_id));
      });
      queue.forEach((item) => {
        const p = item.payload || {};
        if ((item.type === 'inspection_tag' || item.type === 'INSPECTION_TAG' || item.type === 'DEVICE_TAG') && String(p.inspection_schedule_id) === strId) {
          [item.tempId, p.offline_temp_id, p.temp_id, p.id].filter(Boolean).forEach((v) => childTagIds.add(String(v)));
          if (p.session_id) childSessionIds.add(String(p.session_id));
        }
      });

      const toDelete = queue.filter((item) => {
        const p = item.payload || {};
        const isSchedule =
          (item.type === 'inspection_schedule' || item.type === 'INSPECTION_SCHEDULE') &&
          (item.tempId === strId || String(item.targetId) === strId || String(p.id) === strId || String(p.temp_id) === strId || String(p.offline_temp_id) === strId);
        const isChildTag =
          (item.type === 'inspection_tag' || item.type === 'INSPECTION_TAG' || item.type === 'DEVICE_TAG') &&
          (String(p.inspection_schedule_id) === strId || childTagIds.has(String(item.tempId)) || childTagIds.has(String(p.offline_temp_id)) || childTagIds.has(String(p.id)));
        const isChildReading =
          (item.type === 'sensor_data' || item.type === 'SENSOR_READING') &&
          (String(p.inspection_schedule_id) === strId ||
           childTagIds.has(String(p.inspection_tag_temp_id)) ||
           childTagIds.has(String(item.tempId)) ||
           childTagIds.has(String(p.inspection_tag_id)) ||
           childTagIds.has(String(p.tag_id)) ||
           (p.session_id && childSessionIds.has(String(p.session_id))));
        return isSchedule || isChildTag || isChildReading;
      });

      for (const item of toDelete) {
        if (item.photoStoreId) {
          await this.removePhoto(item.photoStoreId).catch(() => {});
        }
        await this.removeQueueItem(item.id);
      }

      for (const tagId of childTagIds) {
        this.removeOfflineTag(tagId);
        await this.deleteTagFromIDB(tagId).catch(() => {});
      }
    } catch (e) {
      console.warn('[OfflineStorage] Error purging queued items for schedule:', e);
    }

    this.removeOfflineSchedule(strId);
    await this.deleteScheduleFromIDB(strId);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tags_updated'));
      window.dispatchEvent(new CustomEvent('schedules_updated'));
      window.dispatchEvent(new CustomEvent('sync_queue_changed'));
    }
  }

  async getAllTagsFromIDB(filter?: { scheduleId?: number | string; siteId?: number | string; scheduleTempId?: string }): Promise<any[]> {
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(TAGS_STORE, 'readonly');
      const store = tx.objectStore(TAGS_STORE);
      const req = store.getAll();
      req.onsuccess = async () => {
        let list: any[] = req.result || [];
        if (list.length === 0) {
          const offline = this.getOfflineTags();
          if (offline.length > 0) {
            await this.upsertTagsToIDB(offline);
            list = offline;
          }
        }
        try {
          const queue = await this.getQueue();
          const byId = new Map<string, any>();
          list.forEach((t: any) => byId.set(String(t.id), t));
          for (const q of queue) {
            if ((q.type === 'inspection_tag' || q.type === 'INSPECTION_TAG') && q.action !== 'update') {
              const p = q.payload || q.data || {};
              const tid = String(q.tempId || p.offline_temp_id || p.temp_id || p.id || '');
              if (tid && !byId.has(tid)) {
                byId.set(tid, { ...p, id: tid, offline_temp_id: tid, isOffline: true, created_at: p.created_at || q.createdAt });
              }
            }
          }
          list = Array.from(byId.values());
        } catch { /* ignore */ }
        if (filter?.scheduleId) {
          const schedId = String(filter.scheduleId);
          const tempId = filter.scheduleTempId ? String(filter.scheduleTempId) : null;
          list = list.filter((t: any) => {
            const matchSched = String(t.inspection_schedule_id) === schedId;
            const matchTemp = tempId && String(t.inspection_schedule_id) === tempId;
            return matchSched || matchTemp;
          });
        }
        if (filter?.siteId) {
          const siteStr = String(filter.siteId);
          list = list.filter((t: any) => !t.inspection_site_id || String(t.inspection_site_id) === siteStr);
        }
        resolve(list);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async upsertTagsToIDB(tags: any[]): Promise<void> {
    if (!Array.isArray(tags) || tags.length === 0) return;
    const db = await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(TAGS_STORE, 'readwrite');
      const store = tx.objectStore(TAGS_STORE);
      tags.forEach((t) => {
        const id = t.id !== undefined && t.id !== null ? t.id : t.offline_temp_id || t.temp_id;
        if (id !== undefined && id !== null) {
          store.put({ ...t, id });
        }
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async deleteTagFromIDB(id: string | number): Promise<void> {
    const db = await this.initDB();
    const strId = String(id);
    const numId = Number(id);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(TAGS_STORE, 'readwrite');
      const store = tx.objectStore(TAGS_STORE);
      store.delete(strId);
      if (!isNaN(numId)) store.delete(numId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  public getOfflineTags(): any[] {
    try {
      const data = localStorage.getItem('offline_inspection_tags');
      return data ? JSON.parse(data) : [];
    } catch { return []; }
  }

  public saveOfflineTag(tag: any): void {
    const list = this.getOfflineTags().filter((t: any) => t.id !== tag.id);
    list.unshift(tag);
    localStorage.setItem('offline_inspection_tags', JSON.stringify(list));
    this.upsertTagsToIDB([{ ...tag, isOffline: true, offline_temp_id: tag.id }]);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tags_updated'));
    }
  }

  public removeOfflineTag(id: string | number): void {
    const list = this.getOfflineTags().filter((t: any) => String(t.id) !== String(id));
    localStorage.setItem('offline_inspection_tags', JSON.stringify(list));
    this.deleteTagFromIDB(id).then(() => {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('tags_updated'));
      }
    });
  }

  /**
   * Purge a tag and all its queued sensor_data readings, photos, and queue records.
   */
  async deleteTagAndChildren(tagTempId: string): Promise<void> {
    const strId = String(tagTempId);
    try {
      const queue = await this.getQueue();
      const sessionIds = new Set<string>();
      queue.forEach((item) => {
        const p = item.payload || {};
        if ((item.type === 'inspection_tag' || item.type === 'INSPECTION_TAG' || item.type === 'DEVICE_TAG') &&
            (item.tempId === strId || String(item.targetId) === strId || String(p.id) === strId || String(p.temp_id) === strId || String(p.offline_temp_id) === strId)) {
          if (p.session_id) sessionIds.add(String(p.session_id));
        }
      });
      const toDelete = queue.filter((item) => {
        const p = item.payload || {};
        const isChildReading =
          (item.type === 'sensor_data' || item.type === 'SENSOR_READING') &&
          (p.inspection_tag_temp_id === strId ||
           item.tempId === strId ||
           String(p.inspection_tag_id) === strId ||
           String(p.tag_id) === strId ||
           (p.session_id && sessionIds.has(String(p.session_id))));
        const isTagItem =
          (item.type === 'inspection_tag' || item.type === 'INSPECTION_TAG' || item.type === 'DEVICE_TAG') &&
          (item.tempId === strId || String(item.targetId) === strId || String(p.id) === strId || String(p.temp_id) === strId || String(p.offline_temp_id) === strId);
        return isChildReading || isTagItem;
      });

      for (const item of toDelete) {
        if (item.photoStoreId) {
          await this.removePhoto(item.photoStoreId).catch(() => {});
        }
        await this.removeQueueItem(item.id);
      }
    } catch (e) {
      console.warn('[OfflineStorage] Error purging queued readings for tag:', e);
    }

    this.removeOfflineTag(strId);
    await this.deleteTagFromIDB(strId);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('tags_updated'));
      window.dispatchEvent(new CustomEvent('sync_queue_changed'));
    }
  }

  /** Remove all offline schedules belonging to a site and return their IDs. */
  public removeOfflineSchedulesBySite(siteId: string | number): string[] {
    const siteStr = String(siteId);
    const all = this.getOfflineSchedules();
    const removed = all.filter((s: any) => String(s.inspection_site_id) === siteStr).map((s: any) => String(s.id));
    const kept = all.filter((s: any) => String(s.inspection_site_id) !== siteStr);
    localStorage.setItem('offline_inspection_schedules', JSON.stringify(kept));
    return removed;
  }

  /** Remove all offline tags belonging to a site or whose schedule ID is in the given list. */
  public removeOfflineTagsBySiteOrSchedules(siteId: string | number, scheduleIds: string[]): void {
    const siteStr = String(siteId);
    const schedSet = new Set(scheduleIds);
    const kept = this.getOfflineTags().filter((t: any) =>
      String(t.inspection_site_id) !== siteStr && !schedSet.has(String(t.inspection_schedule_id))
    );
    localStorage.setItem('offline_inspection_tags', JSON.stringify(kept));
  }

  /** Purge IndexedDB queue items and photos for a deleted site and all its child schedules/tags. */
  async purgeQueueItemsForSite(siteId: string | number, scheduleIds: string[]): Promise<void> {
    const siteStr = String(siteId);
    const schedSet = new Set(scheduleIds.map(String));
    try {
      const [idbScheds, idbTags, queue] = await Promise.all([
        this.getAllSchedulesFromIDB(siteId),
        this.getAllTagsFromIDB(),
        this.getQueue(),
      ]);
      idbScheds.forEach((s: any) => [s.id, s.offline_temp_id].filter(Boolean).forEach((v) => schedSet.add(String(v))));
      queue.forEach((item) => {
        const p = item.payload || {};
        if ((item.type === 'inspection_schedule' || item.type === 'INSPECTION_SCHEDULE') && String(p.inspection_site_id) === siteStr) {
          [item.tempId, p.temp_id, p.offline_temp_id, p.id].filter(Boolean).forEach((v) => schedSet.add(String(v)));
        }
      });
      const tagSet = new Set<string>();
      const sessionSet = new Set<string>();
      idbTags.forEach((t: any) => {
        if (String(t.inspection_site_id) === siteStr || schedSet.has(String(t.inspection_schedule_id))) {
          [t.id, t.offline_temp_id].filter(Boolean).forEach((v) => tagSet.add(String(v)));
          if (t.session_id) sessionSet.add(String(t.session_id));
        }
      });
      queue.forEach((item) => {
        const p = item.payload || {};
        if ((item.type === 'inspection_tag' || item.type === 'INSPECTION_TAG' || item.type === 'DEVICE_TAG') &&
            (String(p.inspection_site_id) === siteStr || schedSet.has(String(p.inspection_schedule_id)))) {
          [item.tempId, p.offline_temp_id, p.temp_id, p.id].filter(Boolean).forEach((v) => tagSet.add(String(v)));
          if (p.session_id) sessionSet.add(String(p.session_id));
        }
      });

      const toDelete = queue.filter((item) => {
        const p = item.payload || {};
        const isSite = [p.temp_id, p.offline_temp_id, p.id, p.inspection_site_id, p.site_id, item.tempId].some((v) => String(v) === siteStr);
        const isSched = [item.tempId, p.temp_id, p.offline_temp_id, p.id, p.inspection_schedule_id].some((v) => schedSet.has(String(v)));
        const isTag = [item.tempId, p.offline_temp_id, p.temp_id, p.id].some((v) => tagSet.has(String(v)));
        const isReading = (item.type === 'sensor_data' || item.type === 'SENSOR_READING') &&
          (tagSet.has(String(p.inspection_tag_temp_id)) || tagSet.has(String(item.tempId)) || (p.session_id && sessionSet.has(String(p.session_id))));
        return isSite || isSched || isTag || isReading;
      });

      for (const item of toDelete) {
        if (item.photoStoreId) await this.removePhoto(item.photoStoreId).catch(() => {});
        await this.removeQueueItem(item.id);
      }
      for (const sid of schedSet) await this.deleteScheduleFromIDB(sid).catch(() => {});
      for (const tid of tagSet) await this.deleteTagFromIDB(tid).catch(() => {});
      if (typeof window !== 'undefined') {
        ['tags_updated', 'schedules_updated', 'sync_queue_changed'].forEach((ev) => window.dispatchEvent(new CustomEvent(ev)));
      }
    } catch (e) {
      console.warn('[OfflineStorage] Could not purge queue for deleted site:', e);
    }
  }

  /** Retrieve all cached existing monitoring sites from localStorage. */
  public getCachedSites(): any[] {
    try {
      const data = localStorage.getItem('cached_monitoring_sites');
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /** Cache existing monitoring sites locally for offline access. */
  public saveCachedSites(sites: any[]): void {
    try {
      if (!Array.isArray(sites) || sites.length === 0) return;
      const existing = this.getCachedSites();
      const map = new Map<string, any>();
      existing.forEach((s) => map.set(String(s.id), s));
      sites.forEach((s) => {
        const id = String(s.id);
        map.set(id, { ...map.get(id), ...s });
      });
      localStorage.setItem('cached_monitoring_sites', JSON.stringify(Array.from(map.values())));
    } catch (e) {
      console.warn('[OfflineStorage] Error saving cached sites:', e);
    }
  }

  /** Get a single cached monitoring site by id. */
  public getCachedSiteById(id: string | number): any | null {
    const strId = String(id);
    const sites = this.getCachedSites();
    return sites.find((s) => String(s.id) === strId) || null;
  }

  /** Remove a cached site by id. */
  public removeCachedSite(id: string | number): void {
    const strId = String(id);
    const kept = this.getCachedSites().filter((s) => String(s.id) !== strId);
    localStorage.setItem('cached_monitoring_sites', JSON.stringify(kept));
  }
}

export const offlineStorage = new OfflineStorageService();
export default offlineStorage;
