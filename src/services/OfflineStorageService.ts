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