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