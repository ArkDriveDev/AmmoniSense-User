import { supabase } from './supabase';
import { CreateSitePayload, SiteRegistrationResult, OdorZone, CommunityPolygon } from '../types/site';
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

  let createdOwner: any = null;
  let createdSite: any = null;
  let createdLocation: any = null;
  let photoRecord: any = null;

  try {
    // 1. Get or upsert site_owner by email
    const ownerEmail = payload.owner_email || user.email || `inspector_${user.id.slice(0, 6)}@menro.gov.ph`;
    const ownerName = payload.owner_name || user.user_metadata?.full_name || user.email || 'Inspector Owner';

    const { data: existingOwners } = await supabase
      .from('site_owners')
      .select('*')
      .eq('email', ownerEmail);

    if (existingOwners && existingOwners.length > 0) {
      createdOwner = existingOwners[0];
    } else {
      const { data: newOwner, error: ownerErr } = await supabase
        .from('site_owners')
        .insert([
          {
            owner_name: ownerName,
            email: ownerEmail,
            created_by: user.id,
          },
        ])
        .select('*')
        .single();

      if (ownerErr || !newOwner) {
        throw new Error('Failed to create site owner record: ' + (ownerErr?.message || 'Error'));
      }
      createdOwner = newOwner;
    }

    // 2. Insert into monitoring_sites (no grid cells)
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
      .from('monitoring_sites')
      .insert([sitePayload])
      .select('*')
      .single();

    if (siteErr || !newSite) {
      throw new Error('Failed to register monitoring site: ' + (siteErr?.message || 'Error'));
    }
    createdSite = newSite;

    // 3. Insert initial location record in site_locations
    const locationPayload = {
      site_id: createdSite.id,
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
            site_id: createdSite.id,
            is_site_photo: true,
            is_used: true,
          })
          .eq('id', payload.photo_record_id)
          .select('*')
          .single();
        photoRecord = updatedPhoto;
      } else if (payload.photo_url) {
        const { data: newPhoto } = await supabase
          .from('inspection_photos')
          .insert([
            {
              photo_url: payload.photo_url,
              latitude: payload.latitude,
              longitude: payload.longitude,
              site_id: createdSite.id,
              is_site_photo: true,
              is_used: true,
              uploaded_by: user.id,
            },
          ])
          .select('*')
          .single();
        photoRecord = newPhoto;
      }

      if (photoRecord?.id) {
        await supabase
          .from('monitoring_sites')
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
      await supabase.from('site_locations').delete().eq('site_id', createdSite.id);
      await supabase.from('monitoring_sites').delete().eq('id', createdSite.id);
    }

    throw error;
  }
};

/**
 * Fetch all Odor Zones from Supabase
 */
export const fetchOdorZones = async (): Promise<OdorZone[]> => {
  const { data, error } = await supabase
    .from('odor_zones')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Supabase fetch odor_zones notice:', error.message);
    return [];
  }
  return data || [];
};

/**
 * Save new Odor Zone to Supabase
 */
export const saveOdorZone = async (zone: OdorZone): Promise<OdorZone> => {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id || null;

  const payload = {
    site_id: zone.site_id || null,
    zone_name: zone.zone_name,
    severity_level: zone.severity_level,
    ammonia_ppm: zone.ammonia_ppm,
    coordinates: zone.coordinates,
    created_by: userId,
  };

  const { data, error } = await supabase
    .from('odor_zones')
    .insert([payload])
    .select('*')
    .single();

  if (error) {
    throw new Error('Supabase save odor_zones error: ' + error.message);
  }
  return data;
};

/**
 * Fetch all Community Polygons from Supabase
 */
export const fetchCommunityPolygons = async (): Promise<CommunityPolygon[]> => {
  const { data, error } = await supabase
    .from('community_polygons')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.warn('Supabase fetch community_polygons notice:', error.message);
    return [];
  }
  return data || [];
};

/**
 * Save new Community Polygon to Supabase
 */
export const saveCommunityPolygon = async (poly: CommunityPolygon): Promise<CommunityPolygon> => {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id || null;

  const payload = {
    community_name: poly.community_name,
    community_type: poly.community_type,
    estimated_population: poly.estimated_population,
    coordinates: poly.coordinates,
    created_by: userId,
  };

  const { data, error } = await supabase
    .from('community_polygons')
    .insert([payload])
    .select('*')
    .single();

  if (error) {
    throw new Error('Supabase save community_polygons error: ' + error.message);
  }
  return data;
};

/**
 * Delete a Monitoring Site from Supabase, IndexedDB, and localStorage.
 * Dispatches 'site_deleted' event for automatic UI/map refresh.
 */
export const deleteSite = async (siteId: string | number): Promise<void> => {
  const strId = String(siteId);

  // 1. Always purge local offline site records (IndexedDB + queue + localStorage)
  try {
    await offlineStorage.deleteOfflineSite(strId);
    offlineStorage.removeSiteFromLocalStorage(strId);
  } catch (e) {
    console.warn('Error purging local site record:', e);
  }

  // 2. If it's a online Supabase site (non-temp ID), delete from Supabase tables
  if (!strId.startsWith('temp_') && !strId.startsWith('queue_') && !strId.startsWith('ls_')) {
    try {
      // Delete associated site location records first
      const { error: locErr } = await supabase
        .from('site_locations')
        .delete()
        .eq('site_id', siteId);
      if (locErr) console.warn('Delete site_locations notice:', locErr.message);

      // Delete site record from monitoring_sites
      const { error: siteErr } = await supabase
        .from('monitoring_sites')
        .delete()
        .eq('id', siteId);

      if (siteErr) {
        throw new Error('Failed to delete monitoring site from Supabase: ' + siteErr.message);
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
