// sitesCacheService.ts
// Handles local IndexedDB caching of inspection sites scoped per user.

const DB_NAME = 'AmmoniSenseSitesCacheDB';
const DB_VERSION = 1;
const STORE_NAME = 'sites_cache';

export interface UserSitesCache {
  userId: string;
  sites: any[];
  last_synced_at: string;
}

class SitesCacheService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private initDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'userId' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  private resolveKey(userId?: string | null): string {
    return userId && userId.trim() ? userId : 'anonymous_user';
  }

  public async saveSitesCache(userId: string | undefined, sites: any[]): Promise<void> {
    if (!Array.isArray(sites)) return;
    const db = await this.initDB();
    const key = this.resolveKey(userId);
    const record: UserSitesCache = {
      userId: key,
      sites,
      last_synced_at: new Date().toISOString(),
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(record);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  public async getCachedSites(userId?: string): Promise<any[]> {
    const db = await this.initDB();
    const key = this.resolveKey(userId);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const res: UserSitesCache | undefined = req.result;
        resolve(res?.sites || []);
      };
      req.onerror = () => reject(req.error);
    });
  }

  public async getLastSyncedAt(userId?: string): Promise<string | null> {
    const db = await this.initDB();
    const key = this.resolveKey(userId);

    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => {
        const res: UserSitesCache | undefined = req.result;
        resolve(res?.last_synced_at || null);
      };
      req.onerror = () => reject(req.error);
    });
  }
}

export const sitesCacheService = new SitesCacheService();
export default sitesCacheService;
