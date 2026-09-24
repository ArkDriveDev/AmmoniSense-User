import { supabase } from './supabase';
import { CreateSitePayload, SiteRegistrationResult } from '../types/site';
import offlineStorage from './OfflineStorageService';

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
      current_latitude: (payload as any).current_latitude !== undefined ? (payload as any).current_latitude : payload.latitude,
      current_longitude: (payload as any).current_longitude !== undefined ? (payload as any).current_longitude : payload.longitude,
      address: payload.address || payload.site_name,
      area_size_hectares: payload.area_size_hectares || 1.0,
      notes: payload.notes || null,
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

    createdLocation = {
      inspection_site_id: createdSite.id,
      latitude: payload.latitude,
      longitude: payload.longitude,
      address: payload.address || payload.site_name,
    };

    // 4. Link & update inspection_photo if provided
    if (payload.photo_record_id || payload.photo_url) {
      if (payload.photo_record_id) {
        const { data: updatedPhoto } = await supabase
          .from('inspection_photos')
          .update({
            inspection_site_id: createdSite.id,
            is_site_photo: true,
            is_used: true,
          })
          .eq('id', payload.photo_record_id)
          .select('*')
          .single();
        photoRecord = updatedPhoto;
      } else if (payload.photo_url) {
        const photoData: any = {
          photo_url: payload.photo_url,
          latitude: payload.latitude,
          longitude: payload.longitude,
          inspection_site_id: createdSite.id,
          is_site_photo: true,
          is_used: true,
        };
        let { data: newPhoto, error: photoErr } = await supabase
          .from('inspection_photos')
          .insert([{ ...photoData, captured_by: user.id }])
          .select('*')
          .maybeSingle();

        if (photoErr) {
          const { data: retryPhoto } = await supabase
            .from('inspection_photos')
            .insert([photoData])
            .select('*')
            .maybeSingle();
          newPhoto = retryPhoto;
        }
        photoRecord = newPhoto;
      }

      if (photoRecord?.id) {
        await supabase
          .from('inspection_sites')
          .update({ site_photo_id: photoRecord.id })
          .eq('id', createdSite.id);

        createdSite.site_photo_id = photoRecord.id;
      }
    }

    return {
      site: createdSite,
      location: createdLocation,
      photo: photoRecord,
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
export const deleteSite = async (siteId: string | number): Promise<void> => {
  const strId = String(siteId);

  // 1. Cascade-remove offline schedules + tags from localStorage and the IndexedDB queue
  try {
    const removedScheduleIds = offlineStorage.removeOfflineSchedulesBySite(strId);
    offlineStorage.removeOfflineTagsBySiteOrSchedules(strId, removedScheduleIds);
    await offlineStorage.purgeQueueItemsForSite(strId, removedScheduleIds);
    await offlineStorage.deleteOfflineSite(strId);
    offlineStorage.removeSiteFromLocalStorage(strId);
  } catch (e) {
    console.warn('Error purging local site/schedule/tag records:', e);
  }

  // 2. If it's an online Supabase site (non-temp ID), cascade delete from Supabase tables
  if (!strId.startsWith('temp_') && !strId.startsWith('queue_') && !strId.startsWith('ls_')) {
    try {
      // Fetch child schedule IDs for cascading tag/photo deletes
      const { data: schedRows } = await supabase
        .from('inspection_schedules')
        .select('id')
        .eq('inspection_site_id', siteId);
      const schedIds = (schedRows || []).map((s: any) => s.id);

      // Delete inspection_tags under those schedules
      if (schedIds.length > 0) {
        await supabase.from('inspection_tags').delete().in('inspection_schedule_id', schedIds);
      }

      // Delete inspection_schedules under this site
      await supabase.from('inspection_schedules').delete().eq('inspection_site_id', siteId);

      // Delete sensor_data directly linked to this site via inspection_site_id (new FK)
      await supabase.from('sensor_data').delete().eq('inspection_site_id', siteId);

      // Find & delete inspection photos and sensor data linked through photo IDs
      const { data: photos } = await supabase
        .from('inspection_photos')
        .select('id')
        .eq('inspection_site_id', siteId);

      if (photos && photos.length > 0) {
        const photoIds = photos.map((p) => p.id);
        await supabase.from('sensor_data').delete().in('inspection_photo_id', photoIds);
        await supabase.from('inspection_photos').delete().in('id', photoIds);
      }

      // Find site devices and delete their sensor data
      const { data: devRows } = await supabase
        .from('devices')
        .select('device_uid')
        .eq('inspection_site_id', siteId);

      if (devRows && devRows.length > 0) {
        const devUids = devRows.map((d) => d.device_uid);
        await supabase.from('sensor_data').delete().in('device_uid', devUids);
        await supabase.from('devices').delete().eq('inspection_site_id', siteId);
      }

      // Finally delete the site record
      const { error: siteErr } = await supabase
        .from('inspection_sites')
        .delete()
        .eq('id', siteId);

      if (siteErr) {
        throw new Error('Failed to delete inspection site from Supabase: ' + siteErr.message);
      }
    } catch (err) {
      console.error('Error deleting site from Supabase:', err);
      throw err;
    }
  }

  // 3. Notify all listeners (UserMap, UserSites, etc.) via custom event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('site_deleted', { detail: { siteId: strId } }));
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
