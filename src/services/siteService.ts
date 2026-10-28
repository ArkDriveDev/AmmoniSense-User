import { supabase } from './supabase';
import { CreateSitePayload, SiteRegistrationResult } from '../types/site';
import offlineStorage from './OfflineStorageService';
import sitesCacheService from './sitesCacheService';
import { deleteStorageFiles, uploadSitePhoto } from './photoStorageService';
import { dataUrlToBlob, createThumbnail } from '../utils/thumbnailUtils';
import { isOnline, withTimeout } from '../utils/networkUtils';

/**
 * Register Monitoring Site with photo & GPS without grid cells.
 */
export const registerSiteWithPhoto = async (
  payload: CreateSitePayload
): Promise<SiteRegistrationResult> => {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error('User authentication required');

  let createdSite: any = null;
  let createdLocation: any = null;
  let photoRecord: any = null;

  try {
    // 1. Insert into inspection_sites
    const sitePayload = {
      site_code: payload.site_code,
      site_name: payload.site_name,
      site_type: payload.site_type,
      poultry_type: payload.poultry_type || null,
      chicken_type: payload.chicken_type || null,
      current_latitude: (payload as any).current_latitude !== undefined ? (payload as any).current_latitude : payload.latitude,
      current_longitude: (payload as any).current_longitude !== undefined ? (payload as any).current_longitude : payload.longitude,
      address: payload.address || payload.site_name,
      area_size_hectares: payload.area_size_hectares || 1.0,
      site_photo_url: (payload as any).site_photo_url || payload.photo_url || null,
      site_photo_thumbnail: (payload as any).site_photo_thumbnail || (payload as any).site_photo_url || payload.photo_url || null,
      site_photo_storage_path: payload.site_photo_storage_path || null,
      site_photo_thumbnail_storage_path: payload.site_photo_thumbnail_storage_path || null,
      offline_temp_id: (payload as any).temp_id || (payload as any).offline_temp_id || null,
      created_by: user.id,
      updated_by: user.id,
      is_active: true,
    };

    const { data: newSite, error: siteErr } = await supabase
      .from('inspection_sites')
      .insert([sitePayload])
      .select('*')
      .single();

    if (siteErr || !newSite) {
      throw new Error('Failed to register inspection site: ' + (siteErr?.message || 'Error'));
    }
    createdSite = newSite;

    // 2. Post-insert photo upload to fixed path `${siteId}/site_photo.jpg` if raw photo data is present
    const rawPhoto = (payload as any).site_photo_url || payload.photo_url;
    if (rawPhoto && typeof rawPhoto === 'string' && rawPhoto.startsWith('data:')) {
      try {
        const photoBlob = dataUrlToBlob(rawPhoto);
        const thumbDataUrl = await createThumbnail(rawPhoto);
        const thumbBlob = thumbDataUrl ? dataUrlToBlob(thumbDataUrl) : null;
        const uploaded = await uploadSitePhoto(photoBlob, thumbBlob, createdSite.id);
        const { error: updErr } = await supabase
          .from('inspection_sites')
          .update({
            site_photo_url: uploaded.site_photo_url,
            site_photo_thumbnail: uploaded.site_photo_thumbnail,
            site_photo_storage_path: uploaded.site_photo_storage_path,
            site_photo_thumbnail_storage_path: uploaded.site_photo_thumbnail_storage_path,
          })
          .eq('id', createdSite.id);
        if (!updErr) {
          createdSite.site_photo_url = uploaded.site_photo_url;
          createdSite.site_photo_thumbnail = uploaded.site_photo_thumbnail;
          createdSite.site_photo_storage_path = uploaded.site_photo_storage_path;
          createdSite.site_photo_thumbnail_storage_path = uploaded.site_photo_thumbnail_storage_path;
        }
      } catch (photoErr) {
        console.warn('[siteService] Post-registration site photo upload failed:', photoErr);
      }
    }

    createdLocation = {
      inspection_site_id: createdSite.id,
      latitude: payload.latitude,
      longitude: payload.longitude,
      address: payload.address || payload.site_name,
    };

    return {
      site: createdSite,
      location: createdLocation,
      photo: null,
    };
  } catch (error: any) {
    console.error('Transaction failure during site registration, initiating cleanup rollback:', error);

    if (createdSite?.id) {
      await supabase.from('inspection_sites').delete().eq('id', createdSite.id);
    }

    throw error;
  }
};

/**
 * Delete a Monitoring Site from Supabase, IndexedDB, and localStorage.
 * Cascades to inspection_schedules, inspection_tags, and all related photos.
 * Dispatches 'site_deleted' event for automatic UI/map refresh.
 */
/**
 * Delete an unsynced monitoring site and all its child offline schedules, tags, readings, and photos.
 * Deletes in strict order: readings -> tags -> schedules -> site registration -> photos -> caches -> site.
 * No Supabase call is made.
 */
export const deleteUnsyncedSite = async (tempId: string | number): Promise<void> => {
  const strId = String(tempId);
  try {
    const removedScheduleIds = offlineStorage.removeOfflineSchedulesBySite(strId);
    offlineStorage.removeOfflineTagsBySiteOrSchedules(strId, removedScheduleIds);
    await offlineStorage.purgeQueueItemsForSite(strId, removedScheduleIds);
    await offlineStorage.deleteOfflineSite(strId);
    offlineStorage.removeSiteFromLocalStorage(strId);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('site_deleted', { detail: { siteId: strId } }));
      window.dispatchEvent(new CustomEvent('sites_updated'));
      window.dispatchEvent(new CustomEvent('schedules_updated'));
      window.dispatchEvent(new CustomEvent('tags_updated'));
    }
  } catch (err) {
    console.error('Error deleting unsynced site:', err);
    throw err;
  }
};

export const deleteSite = async (siteId: string | number): Promise<void> => {
  const strId = String(siteId);
  const isUnsynced = strId.startsWith('temp_') || strId.startsWith('queue_') || strId.startsWith('ls_');

  if (isUnsynced) {
    return deleteUnsyncedSite(strId);
  }
    try {
      // Fetch site photo storage paths for bucket cleanup
      const { data: siteRow } = await supabase
        .from('inspection_sites')
        .select('site_photo_storage_path, site_photo_thumbnail_storage_path')
        .eq('id', siteId)
        .maybeSingle();

      // Fetch child schedule IDs for cascading tag/photo deletes
      const { data: schedRows } = await supabase
        .from('inspection_schedules')
        .select('id')
        .eq('inspection_site_id', siteId);
      const schedIds = (schedRows || []).map((s: any) => s.id);

      // Fetch all child tag photo storage paths
      let tagPhotoRows: any[] = [];
      if (schedIds.length > 0) {
        const { data } = await supabase
          .from('inspection_tags')
          .select('photo_storage_path, photo_thumbnail_storage_path')
          .in('inspection_schedule_id', schedIds);
        tagPhotoRows = data || [];
      }

      // Delete inspection_tags under those schedules
      if (schedIds.length > 0) {
        await supabase.from('inspection_tags').delete().in('inspection_schedule_id', schedIds);
      }

      // Delete inspection_schedules under this site
      await supabase.from('inspection_schedules').delete().eq('inspection_site_id', siteId);

      // Delete sensor_data directly linked to this site via inspection_site_id (new FK)
      await supabase.from('sensor_data').delete().eq('inspection_site_id', siteId);

      // Finally delete the site record
      const { error: siteErr } = await supabase
        .from('inspection_sites')
        .delete()
        .eq('id', siteId);

      if (siteErr) {
        throw new Error('Failed to delete inspection site from Supabase: ' + siteErr.message);
      }

      // Best-effort: clean up storage bucket files AFTER DB rows are gone
      // Remove tag photos
      const tagPhotoPaths = tagPhotoRows.map((r: any) => r.photo_storage_path).filter(Boolean);
      const tagThumbPaths = tagPhotoRows.map((r: any) => r.photo_thumbnail_storage_path).filter(Boolean);
      if (tagPhotoPaths.length > 0) await deleteStorageFiles('inspection-photos', tagPhotoPaths);
      if (tagThumbPaths.length > 0) await deleteStorageFiles('inspection-thumbnails', tagThumbPaths);

      // Remove site photo
      await deleteStorageFiles('site-photos', [
        siteRow?.site_photo_storage_path,
        siteRow?.site_photo_thumbnail_storage_path,
      ]);
    } catch (err) {
      console.error('Error deleting site from Supabase:', err);
      throw err;
    }

  // 3. Notify all listeners (UserMap, UserSites, etc.) via custom event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('site_deleted', { detail: { siteId: strId } }));
    window.dispatchEvent(new CustomEvent('sites_updated'));
  }
};

/**
 * Delete a single sensor reading from Supabase or offline queue.
 */
export const deleteReading = async (readingId: string | number): Promise<void> => {
  const strId = String(readingId);
  try {
    await offlineStorage.deleteOfflineReading(strId);
  } catch (e) {
    console.warn('Error purging local reading:', e);
  }

  if (!strId.startsWith('queue_') && !isNaN(Number(strId))) {
    try {
      await supabase.from('sensor_data').delete().eq('id', Number(strId));
    } catch (e) {
      console.warn('Error deleting sensor reading from Supabase:', e);
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sensor_synced'));
  }
};

/**
 * Fetch all monitoring sites with IndexedDB as single source of truth:
 * - Reads locally stored sites immediately from IndexedDB (all_sites)
 * - Kicks off background fetch from Supabase to upsert into IndexedDB
 * - Unsynced sites with offline_temp_id are never overwritten or deleted
 */
export const fetchSites = async (userId?: string): Promise<any[]> => {
  const idbSites = await offlineStorage.getAllSitesFromIDB();

  const formatList = (raw: any[]) =>
    raw
      .filter((s: any) => !userId || !s.created_by || s.created_by === userId)
      .map((s: any) => {
        const isOffline = Boolean(s.isOffline || s.offline_temp_id || String(s.id).startsWith('temp_'));
        return {
          ...s,
          isOffline,
          is_pending_sync: isOffline,
          location: s.location || s.address,
          address: s.address || s.location,
        };
      });

  if (isOnline()) {
    (async () => {
      try {
        let q = supabase.from('inspection_sites').select('*');
        if (userId) q = q.eq('created_by', userId);
        const { data, error } = await withTimeout<any>(q, 3500);
        if (!error && Array.isArray(data)) {
          await offlineStorage.upsertSitesToIDB(data);
          offlineStorage.saveCachedSites(data);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sites_updated'));
          }
        }
      } catch (err) {
        console.warn('[siteService] Background Supabase fetch failed:', err);
      }
    })();
  }

  return formatList(idbSites);
};

/**
 * Fetch a single site by ID with offline fallback
 */
export const fetchSiteById = async (siteId: string | number): Promise<any | null> => {
  const strId = String(siteId);

  if (strId.startsWith('temp_') || strId.startsWith('queue_')) {
    const offlineRecords = await offlineStorage.getOfflineSites();
    const match = offlineRecords.find((os) => String(os.id) === strId || os.site_code === strId);
    if (match) return { ...match, isOffline: true };
  }

  if (isOnline()) {
    try {
      const { data, error } = await withTimeout<any>(
        supabase.from('inspection_sites').select('*').eq('id', siteId).maybeSingle(),
        3500
      );
      if (!error && data) {
        offlineStorage.saveCachedSites([data]);
        return data;
      }
    } catch (err) {
      console.warn('[siteService] fetchSiteById offline fallback:', err);
    }
  }

  const cached = await sitesCacheService.getCachedSites();
  const matchCached = cached.find((s: any) => String(s.id) === strId);
  if (matchCached) return matchCached;

  return offlineStorage.getCachedSiteById(siteId);
};


