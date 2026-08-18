// OfflineStorageService.ts
// Handles localStorage for auth session & form drafts, and IndexedDB for offline queue & photo blobs.

import { OfflineSite } from '../types/site';

export interface QueueItem {
  id: string;
  type: 'SENSOR_READING' | 'SITE_REGISTRATION' | 'DEVICE_TAG';
  payload: any;
  photoStoreId?: string;
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
const DB_VERSION = 2;
const QUEUE_STORE = 'offline_queue';
const PHOTO_STORE = 'photo_store';
const OFFLINE_SITES_STORE = 'offline_sites';

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