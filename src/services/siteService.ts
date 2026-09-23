import { supabase } from './supabase';
import { CreateSitePayload, SiteRegistrationResult, OdorZone } from '../types/site';
import offlineStorage from './OfflineStorageService';
import { fromGeoJSONPolygon } from '../utils/spatialUtils';

/**
 * Register Monitoring Site with photo & GPS without grid cells.
 */
export const registerSiteWithPhoto = async (
  payload: CreateSitePayload
): Promise<SiteRegistrationResult> => {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error('User authentication required');

  let createdOwner: any = null;
  let createdSite: any = null;
  let createdLocation: any = null;
  let photoRecord: any = null;

  try {
    // 1. Get or upsert site_owner by created_by or email
    const ownerEmail = payload.owner_email || user.email || `inspector_${user.id.slice(0, 6)}@menro.gov.ph`;
    const ownerName = payload.owner_name || user.user_metadata?.full_name || user.email || 'Inspector Owner';

    // First try querying existing owner by creator ID
    const { data: ownersByCreator } = await supabase
      .from('site_owners')
      .select('*')
      .eq('created_by', user.id);

    if (ownersByCreator && ownersByCreator.length > 0) {
      createdOwner = ownersByCreator[0];
    } else {
      // If none found by creator, try querying by email (if column exists)
      let matchedOwner: any = null;
      try {
        const { data: ownersByEmail } = await supabase
          .from('site_owners')
          .select('*')
          .eq('email', ownerEmail);
        if (ownersByEmail && ownersByEmail.length > 0) {
          matchedOwner = ownersByEmail[0];
        }
      } catch {
        // Schema cache might not have email column yet
      }

      if (matchedOwner) {
        createdOwner = matchedOwner;
      } else {
        // Attempt insert with email first
        let { data: newOwner, error: ownerErr } = await supabase
          .from('site_owners')
          .insert([{ owner_name: ownerName, email: ownerEmail, created_by: user.id }])
          .select('*')
          .maybeSingle();

        // If email column doesn't exist, retry insert without email
        if (ownerErr && (ownerErr.message?.includes('email') || ownerErr.code === '42703' || ownerErr.code === 'PGRST204')) {
          const { data: retryOwner, error: retryErr } = await supabase
            .from('site_owners')
            .insert([{ owner_name: ownerName, created_by: user.id }])
            .select('*')
            .maybeSingle();
          newOwner = retryOwner;
          ownerErr = retryErr;
        }

        if (ownerErr || !newOwner) {
          throw new Error('Failed to create site owner record: ' + (ownerErr?.message || 'Error'));
        }
        createdOwner = newOwner;
      }
    }

    // 2. Insert into inspection_sites (no grid cells)
    const sitePayload = {
      site_code: payload.site_code,
      site_name: payload.site_name,
      site_type: payload.site_type,
      owner_id: createdOwner.id,
      current_latitude: payload.latitude,
      current_longitude: payload.longitude,
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

    // 3. Insert initial location record in site_locations
    const locationPayload = {
      inspection_site_id: createdSite.id,
      latitude: payload.latitude,
      longitude: payload.longitude,
      address: payload.address || payload.site_name,
      recorded_by: user.id,
      notes: `Initial registration location recorded via ${payload.gps_source || 'GPS'}.`,
    };

    const { data: newLoc, error: locErr } = await supabase
      .from('site_locations')
      .insert([locationPayload])
      .select('*')
      .single();

    if (locErr) {
      console.warn('Notice writing to site_locations:', locErr.message);
    }
    createdLocation = newLoc || locationPayload;

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
          .insert([{ ...photoData, uploaded_by: user.id }])
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
      owner: createdOwner,
      site: createdSite,
      location: createdLocation,
      photo: photoRecord,
    };
  } catch (error: any) {
    console.error('Transaction failure during site registration, initiating cleanup rollback:', error);

    if (createdSite?.id) {
      await supabase.from('site_locations').delete().eq('inspection_site_id', createdSite.id);
      await supabase.from('inspection_sites').delete().eq('id', createdSite.id);
    }

    throw error;
  }
};

/**
 * Fetch all Odor Zones from Supabase
 */
export const fetchOdorZones = async (): Promise<OdorZone[]> => {
  try {
    // Attempt fetching with joined site name
    const { data, error } = await supabase
      .from('odor_zones')
      .select('*, inspection_sites(site_name)')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Supabase fetch odor_zones notice:', error.message);
      return [];
    }

    return (data || []).map((zone: any) => {
      const coords = zone.coordinates
        ? fromGeoJSONPolygon(zone.coordinates)
        : (zone.polygon_geojson ? fromGeoJSONPolygon(zone.polygon_geojson) : []);
      return {
        ...zone,
        site_name: zone.inspection_sites?.site_name || zone.monitoring_sites?.site_name || zone.site_name,
        coordinates: coords,
      };
    });
  } catch (err: any) {
    console.error('Error fetching odor zones:', err);
    return [];
  }
};

/**
 * Fetch Odor Zone Reading Statistics view
 */
export const fetchZoneReadingStats = async (): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from('zone_reading_stats')
      .select('*');

    if (error) {
      console.warn('Supabase fetch zone_reading_stats notice:', error.message);
      return [];
    }
    return data || [];
  } catch (err: any) {
    console.warn('Error fetching zone_reading_stats:', err);
    return [];
  }
};

/**
 * Save new Odor Zone to Supabase
 */
export const saveOdorZone = async (zone: OdorZone): Promise<OdorZone> => {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id || null;

  const payload = {
    inspection_site_id: zone.site_id,
    zone_name: zone.zone_name,
    polygon_geojson: zone.polygon_geojson,
    center_latitude: zone.center_latitude || null,
    center_longitude: zone.center_longitude || null,
    area_size_hectares: zone.area_size_hectares || null,
    notes: zone.notes || null,
    created_by: userId,
  };

  const { data, error } = await supabase
    .from('odor_zones')
    .insert([payload])
    .select('*, inspection_sites(site_name)')
    .single();

  if (error) {
    throw new Error('Supabase save odor_zones error: ' + error.message);
  }

  const coords = data.polygon_geojson ? fromGeoJSONPolygon(data.polygon_geojson) : data.coordinates || [];
  return {
    ...data,
    site_name: data.inspection_sites?.site_name || data.monitoring_sites?.site_name || data.site_name,
    coordinates: coords,
  };
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

      // Delete associated odor zones and site location records
      await supabase.from('odor_zones').delete().eq('site_id', siteId);
      await supabase.from('site_locations').delete().eq('inspection_site_id', siteId);

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
