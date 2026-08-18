// SyncService.ts
// Handles auto-syncing of IndexedDB queued items when back online, with retry logic.

import offlineStorage, { QueueItem } from './OfflineStorageService';
import { supabase } from './supabase';

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