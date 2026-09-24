import { supabase } from './supabase';
import offlineStorage from './OfflineStorageService';
import { InspectionTag, CreateTagPayload, calculateAmmoniaStatus, toUpperClean } from '../types/inspection';
import { getSignedPhotoUrl } from './photoStorageService';

const parseNum = (v: any, fallback: number): number =>
  v !== undefined && v !== null && !isNaN(Number(v)) ? Number(v) : fallback;

const formatTag = (d: any, isOffline = false): InspectionTag => ({
  id: d.id,
  tag_name: d.tag_name,
  ammonia: parseNum(d.ammonia, 0),
  temperature: parseNum(d.temperature, 0),
  humidity: parseNum(d.humidity, 0),
  battery: parseNum(d.battery, 100),
  status: d.status || calculateAmmoniaStatus(d.ammonia ?? 0),
  latitude: parseNum(d.latitude, 0),
  longitude: parseNum(d.longitude, 0),
  photo_url: d.photo_url,
  photo_thumbnail_url: d.photo_thumbnail_url,
  device_uid: d.device_uid,
  sensor_data_id: d.sensor_data_id ?? null,
  inspection_schedule_id: d.inspection_schedule_id,
  inspection_site_id: d.inspection_site_id ?? null,
  notes: d.notes,
  offline_temp_id: d.offline_temp_id ?? null,
  created_by: d.created_by,
  created_at: d.created_at,
  isOffline,
});

export async function fetchTags(filter?: { scheduleId?: number | string; siteId?: number | string }): Promise<InspectionTag[]> {
  let online: InspectionTag[] = [];
  try {
    let q = supabase.from('inspection_tags').select('*').order('created_at', { ascending: false });
    if (filter?.scheduleId) q = q.eq('inspection_schedule_id', filter.scheduleId);
    if (filter?.siteId) q = q.eq('inspection_site_id', filter.siteId);
    const { data } = await q;
    if (data) {
      online = await Promise.all(
        data.map(async (d: any) => {
          const t = formatTag(d, false);
          if (t.photo_thumbnail_url && !t.photo_thumbnail_url.startsWith('data:')) {
            const signed = await getSignedPhotoUrl('inspection-thumbnails', t.photo_thumbnail_url);
            if (signed) t.photo_thumbnail_url = signed;
          }
          if (t.photo_url && !t.photo_url.startsWith('data:')) {
            const signed = await getSignedPhotoUrl('inspection-photos', t.photo_url);
            if (signed) t.photo_url = signed;
          }
          return t;
        })
      );
    }
  } catch (err) {
    console.warn('[tagService] Online fetch tags notice:', err);
  }

  const offline = offlineStorage.getOfflineTags().filter((t: any) => {
    if (filter?.scheduleId && String(t.inspection_schedule_id) !== String(filter.scheduleId)) return false;
    if (filter?.siteId && t.inspection_site_id && String(t.inspection_site_id) !== String(filter.siteId)) return false;
    return true;
  });
  const onlineIds = new Set(online.map((t) => String(t.id)));
  return [...offline.filter((t: any) => !onlineIds.has(String(t.id))), ...online];
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
    photo_thumbnail_url: payload.photo_thumbnail_url || null,
    device_uid: payload.device_uid?.trim() || null,
    inspection_schedule_id: payload.inspection_schedule_id,
    inspection_site_id: resolvedSiteId,
    notes: toUpperClean(payload.notes),
  };

  try {
    const user = (await supabase.auth.getUser()).data.user;
    let { data, error } = await supabase
      .from('inspection_tags')
      .insert([{ ...clean, created_by: user?.id }])
      .select()
      .single();

    // Retry without inspection_site_id if FK / column constraint fires
    if (error && (error.code === '23503' || error.code === '22P02' || error.message?.includes('inspection_site'))) {
      console.warn('[tagService] site constraint notice — retrying with inspection_site_id=null.');
      clean.inspection_site_id = null;
      const { data: r1, error: e1 } = await supabase
        .from('inspection_tags')
        .insert([{ ...clean, inspection_site_id: null, created_by: user?.id }])
        .select()
        .single();
      data = r1; error = e1;
    }

    // Retry without device_uid if FK constraint fires (fk_inspection_tags_device)
    if (error && (error.code === '23503' || error.message?.includes('device_uid'))) {
      console.warn('[tagService] device_uid FK violation — retrying with device_uid=null.');
      clean.device_uid = null;
      const { data: r2, error: e2 } = await supabase
        .from('inspection_tags')
        .insert([{ ...clean, device_uid: null, created_by: user?.id }])
        .select()
        .single();
      data = r2; error = e2;
    }

    if (!error && data) {
      window.dispatchEvent(new CustomEvent('tags_updated'));
      return formatTag(data, false);
    }
  } catch (err) {
    console.warn('[tagService] Network offline, saving tag to queue:', err);
  }

  const tempId = `temp_tag_${Date.now()}`;
  const offlineRec = formatTag({ ...clean, id: tempId, created_at: new Date().toISOString() }, true);
  offlineStorage.saveOfflineTag(offlineRec);
  await offlineStorage.enqueueItem('INSPECTION_TAG', { ...clean, temp_id: tempId });
  window.dispatchEvent(new CustomEvent('tags_updated'));
  return offlineRec;
}
