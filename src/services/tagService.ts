import { supabase } from './supabase';
import offlineStorage from './OfflineStorageService';
import { InspectionTag, CreateTagPayload, ViolationCategory, calculateAmmoniaStatus, toUpperClean } from '../types/inspection';
import { getSignedPhotoUrl, deleteStorageFiles, uploadTagPhoto } from './photoStorageService';
import { autoRegisterDevice } from './deviceService';
import { dataUrlToBlob } from '../utils/thumbnailUtils';

const parseNum = (v: any, fallback: number): number =>
  v !== undefined && v !== null && !isNaN(Number(v)) ? Number(v) : fallback;

const formatTag = (d: any, isOffline = false): InspectionTag => {
  const sensor = d.sensor_data || {};
  return {
    id: d.id,
    tag_name: d.tag_name,
    ammonia: parseNum(sensor.ammonia ?? d.ammonia, 0),
    temperature: parseNum(sensor.temperature ?? d.temperature, 0),
    humidity: parseNum(sensor.humidity ?? d.humidity, 0),
    battery: parseNum(sensor.battery ?? d.battery, 100),
    status: sensor.status || d.status || calculateAmmoniaStatus(sensor.ammonia ?? d.ammonia ?? 0),
    latitude: parseNum(d.latitude ?? sensor.latitude, 0),
    longitude: parseNum(d.longitude ?? sensor.longitude, 0),
    photo_url: d.photo_url,
    device_uid: d.device_uid || sensor.device_uid || null,
    sensor_data_id: d.sensor_data_id ?? sensor.id ?? null,
    inspection_schedule_id: d.inspection_schedule_id,
    inspection_site_id: d.inspection_site_id ?? null,
    notes: d.notes,
    violation_category: d.violation_category || null,
    offline_temp_id: d.offline_temp_id ?? null,
    created_by: d.created_by,
    created_at: d.created_at,
    isOffline,
  };
};

export async function fetchTags(filter?: { scheduleId?: number | string; siteId?: number | string; scheduleTempId?: string }): Promise<InspectionTag[]> {
  const [idbTags, queue] = await Promise.all([
    offlineStorage.getAllTagsFromIDB(filter),
    offlineStorage.getQueue().catch(() => []),
  ]);
  const queuedIds = new Set(
    queue.flatMap((q) => [q.tempId, q.targetId, q.payload?.temp_id, q.payload?.offline_temp_id, q.payload?.id]).filter(Boolean).map(String)
  );
  const syncedOfflineTempIds = new Set(
    idbTags.filter((t: any) => !isNaN(Number(t.id)) && t.offline_temp_id).map((t: any) => String(t.offline_temp_id))
  );

  const formatList = (raw: any[]) =>
    raw
      .filter((d: any) => !(isNaN(Number(d.id)) && syncedOfflineTempIds.has(String(d.id))))
      .map((d: any) => {
        const hasNumericId = !String(d.id).startsWith('temp_') && !isNaN(Number(d.id));
        const inQueue = queuedIds.has(String(d.id)) || (d.offline_temp_id ? queuedIds.has(String(d.offline_temp_id)) : false);
        const isOffline = !hasNumericId || inQueue;
        return formatTag(d, isOffline);
      });

  (async () => {
    try {
      let q = supabase.from('inspection_tags').select('*, sensor_data(*)').order('created_at', { ascending: false });
      if (filter?.scheduleId) q = q.eq('inspection_schedule_id', filter.scheduleId);
      if (filter?.siteId) q = q.eq('inspection_site_id', filter.siteId);
      let { data, error } = await q;
      if (error) {
        let fallbackQ = supabase.from('inspection_tags').select('*').order('created_at', { ascending: false });
        if (filter?.scheduleId) fallbackQ = fallbackQ.eq('inspection_schedule_id', filter.scheduleId);
        if (filter?.siteId) fallbackQ = fallbackQ.eq('inspection_site_id', filter.siteId);
        const res = await fallbackQ;
        data = res.data;
      }
      if (data && Array.isArray(data)) {
        const online = await Promise.all(
          data.map(async (d: any) => {
            const t = formatTag(d, false);
            if (t.photo_url && !t.photo_url.startsWith('data:')) {
              const signed = await getSignedPhotoUrl('inspection-photos', t.photo_url);
              if (signed) t.photo_url = signed;
            }
            return t;
          })
        );
        await offlineStorage.upsertTagsToIDB(online);
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('tags_updated'));
      }
    } catch (err) {
      console.warn('[tagService] Background Supabase fetch tags notice:', err);
    }
  })();

  return formatList(idbTags);
}

export async function createTag(payload: CreateTagPayload): Promise<InspectionTag> {
  // Resolve inspection_site_id if valid; tags do NOT require it (defaults to null)
  let resolvedSiteId: number | null = null;
  if (payload.inspection_site_id !== null && payload.inspection_site_id !== undefined) {
    if (typeof payload.inspection_site_id === 'number') {
      resolvedSiteId = payload.inspection_site_id;
    } else if (typeof payload.inspection_site_id === 'string') {
      if (payload.inspection_site_id.startsWith('temp_')) {
        try {
          const map = JSON.parse(localStorage.getItem('tempIdMap') || '{}');
          if (map[payload.inspection_site_id]) resolvedSiteId = Number(map[payload.inspection_site_id]);
        } catch { /* ignore */ }
      } else if (!isNaN(Number(payload.inspection_site_id)) && payload.inspection_site_id.trim() !== '') {
        resolvedSiteId = Number(payload.inspection_site_id);
      }
    }
  }

  const clean = {
    tag_name: toUpperClean(payload.tag_name),
    ammonia: parseNum(payload.ammonia, 0),
    temperature: parseNum(payload.temperature, 0),
    humidity: parseNum(payload.humidity, 0),
    battery: parseNum(payload.battery, 100),
    status: payload.status || calculateAmmoniaStatus(payload.ammonia ?? 0),
    latitude: parseNum(payload.latitude, 0),
    longitude: parseNum(payload.longitude, 0),
    photo_url: payload.photo_url || null,
    photo_storage_path: (payload as any).photo_storage_path || null,
    photo_thumbnail_storage_path: (payload as any).photo_thumbnail_storage_path || null,
    device_uid: payload.device_uid?.trim() || null,
    sensor_data_id: payload.sensor_data_id ? Number(payload.sensor_data_id) : null,
    inspection_schedule_id: payload.inspection_schedule_id,
    inspection_site_id: resolvedSiteId,
    notes: toUpperClean(payload.notes),
    violation_category: payload.violation_category || null,
    offline_temp_id: payload.offline_temp_id || null,
  };

  const tempId = payload.offline_temp_id || `temp_tag_${Date.now()}`;

  // Save photo to IndexedDB photo store if provided as dataUrl
  let photoStoreId: string | undefined = undefined;
  if (clean.photo_url && clean.photo_url.startsWith('data:')) {
    try {
      photoStoreId = await offlineStorage.savePhoto(clean.photo_url);
    } catch (e) {
      console.warn('[tagService] Failed to save photo to IndexedDB:', e);
      clean.notes = clean.notes ? `${clean.notes} [PHOTO PENDING]` : '[PHOTO PENDING]';
    }
  }

  const offlineRec = formatTag({ ...clean, id: tempId, offline_temp_id: tempId, created_at: new Date().toISOString() }, true);
  await offlineStorage.upsertTagsToIDB([offlineRec]);
  const queuePayload = {
    tag_name: clean.tag_name,
    inspection_schedule_id: clean.inspection_schedule_id,
    violation_category: clean.violation_category,
    notes: clean.notes,
    latitude: clean.latitude,
    longitude: clean.longitude,
    session_id: (payload as any).session_id || undefined,
    offline_temp_id: tempId,
  };
  await offlineStorage.enqueueItem('inspection_tag', queuePayload, {
    action: 'insert',
    tempId,
    photoStoreId,
  });
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('tags_updated'));
  return offlineRec;
}

export async function updateTag(
  tagId: number | string,
  updates: {
    tag_name?: string;
    notes?: string;
    photo_url?: string | null;
    photo_storage_path?: string | null;
    photo_thumbnail_storage_path?: string | null;
    violation_category?: ViolationCategory | null;
    /** Storage paths of the OLD photo to delete from bucket */
    _old_photo_storage_path?: string | null;
    _old_photo_thumbnail_storage_path?: string | null;
  }
): Promise<void> {
  const clean: any = {};
  if (updates.tag_name !== undefined) clean.tag_name = toUpperClean(updates.tag_name);
  if (updates.notes !== undefined) clean.notes = toUpperClean(updates.notes);
  if (updates.violation_category !== undefined) clean.violation_category = updates.violation_category;
  if (updates.photo_url !== undefined) clean.photo_url = updates.photo_url;
  if (updates.photo_storage_path !== undefined) clean.photo_storage_path = updates.photo_storage_path;
  if (updates.photo_thumbnail_storage_path !== undefined) clean.photo_thumbnail_storage_path = updates.photo_thumbnail_storage_path;

  // Delete old photo files from bucket ONLY if the path actually changed (e.g. legacy name-based path)
  if (updates.photo_storage_path !== undefined && updates._old_photo_storage_path && updates._old_photo_storage_path !== updates.photo_storage_path) {
    await deleteStorageFiles('inspection-photos', [updates._old_photo_storage_path]);
  }
  if (updates.photo_thumbnail_storage_path !== undefined && updates._old_photo_thumbnail_storage_path && updates._old_photo_thumbnail_storage_path !== updates.photo_thumbnail_storage_path) {
    await deleteStorageFiles('inspection-thumbnails', [updates._old_photo_thumbnail_storage_path]);
  }

  const isOffline = typeof tagId === 'string' && tagId.startsWith('temp_');
  let synced = false;

  if (!isOffline && navigator.onLine) {
    try {
      const { error } = await supabase
        .from('inspection_tags')
        .update(clean)
        .eq('id', tagId);
      if (!error) synced = true;
      else console.warn('[tagService] Supabase tag update failed, queueing offline update:', error);
    } catch (err) {
      console.warn('[tagService] Network failed during tag update, queueing offline:', err);
    }
  }

  // Update local IndexedDB cache if present
  const all = await offlineStorage.getAllTagsFromIDB();
  const target = all.find((t: any) => String(t.id) === String(tagId));
  if (target) {
    await offlineStorage.upsertTagsToIDB([{ ...target, ...clean }]);
  }

  // If not synced directly to Supabase, enqueue or update in offline queue
  if (!synced) {
    const queue = await offlineStorage.getQueue();
    const strId = String(tagId);
    const existingQueueItem = queue.find((q) =>
      q.tempId === strId || q.payload?.temp_id === strId || (q.targetId && String(q.targetId) === strId)
    );

    if (existingQueueItem && existingQueueItem.action === 'insert') {
      const updatedPayload = { ...existingQueueItem.payload, ...clean };
      await offlineStorage.updateQueueItemPayload(existingQueueItem.id, updatedPayload);
    } else {
      await offlineStorage.enqueueItem('inspection_tag', clean, {
        action: 'update',
        targetId: !isOffline ? Number(tagId) : null,
        tempId: isOffline ? strId : null,
      });
    }
  }

  window.dispatchEvent(new CustomEvent('tags_updated'));
}

export async function deleteTag(tagId: number | string): Promise<void> {
  const strId = String(tagId);
  const isTemp = strId.startsWith('temp_');

  // Offline tag: purge local copies and queued readings without Supabase call
  if (isTemp) {
    await offlineStorage.deleteTagAndChildren(strId);
    return;
  }

  // 1. Fetch photo storage paths before deleting (online only)
  let photoStoragePath: string | null = null;
  let thumbStoragePath: string | null = null;
  try {
    const { data } = await supabase
      .from('inspection_tags')
      .select('photo_storage_path, photo_thumbnail_storage_path')
      .eq('id', tagId)
      .maybeSingle();
    photoStoragePath = data?.photo_storage_path ?? null;
    thumbStoragePath = data?.photo_thumbnail_storage_path ?? null;
  } catch { /* non-fatal */ }

  // 2. Delete from Supabase first
  try {
    const { error } = await supabase.from('inspection_tags').delete().eq('id', tagId);
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error('[tagService] deleteTag Supabase error:', err);
    throw err;
  }

  // 3. Best-effort storage cleanup
  await deleteStorageFiles('inspection-photos', [photoStoragePath]);
  await deleteStorageFiles('inspection-thumbnails', [thumbStoragePath]);

  // 4. Purge local copies and queued children
  await offlineStorage.deleteTagAndChildren(strId);
}
