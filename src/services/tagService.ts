import { supabase } from './supabase';
import offlineStorage from './OfflineStorageService';
import { InspectionTag, CreateTagPayload, calculateAmmoniaStatus, toUpperClean } from '../types/inspection';

const formatTag = (d: any, isOffline = false): InspectionTag => ({
  id: d.id,
  tag_name: d.tag_name,
  ammonia: Number(d.ammonia) || 0,
  temperature: Number(d.temperature) || 0,
  humidity: Number(d.humidity) || 0,
  battery: Number(d.battery) || 0,
  status: d.status || calculateAmmoniaStatus(d.ammonia),
  latitude: Number(d.latitude) || 0,
  longitude: Number(d.longitude) || 0,
  photo_url: d.photo_url,
  photo_thumbnail_url: d.photo_thumbnail_url,
  device_uid: d.device_uid,
  inspection_schedule_id: d.inspection_schedule_id,
  inspection_site_id: d.inspection_site_id,
  notes: d.notes,
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
    if (data) online = data.map((d: any) => formatTag(d, false));
  } catch (err) {
    console.warn('[tagService] Online fetch tags notice:', err);
  }

  const offline = offlineStorage.getOfflineTags().filter((t: any) => {
    if (filter?.scheduleId && String(t.inspection_schedule_id) !== String(filter.scheduleId)) return false;
    if (filter?.siteId && String(t.inspection_site_id) !== String(filter.siteId)) return false;
    return true;
  });
  const onlineIds = new Set(online.map((t) => String(t.id)));
  return [...offline.filter((t: any) => !onlineIds.has(String(t.id))), ...online];
}

export async function createTag(payload: CreateTagPayload): Promise<InspectionTag> {
  const clean = {
    tag_name: toUpperClean(payload.tag_name),
    ammonia: Number(payload.ammonia) || 0,
    temperature: Number(payload.temperature) || 0,
    humidity: Number(payload.humidity) || 0,
    battery: Number(payload.battery) || 100,
    status: calculateAmmoniaStatus(payload.ammonia),
    latitude: Number(payload.latitude) || 0,
    longitude: Number(payload.longitude) || 0,
    photo_url: payload.photo_url || null,
    photo_thumbnail_url: payload.photo_thumbnail_url || null,
    // Null out device_uid if empty — prevents FK violation on inspection_tags
    device_uid: payload.device_uid?.trim() || null,
    inspection_schedule_id: payload.inspection_schedule_id,
    inspection_site_id: payload.inspection_site_id,
    notes: toUpperClean(payload.notes),
  };

  try {
    const user = (await supabase.auth.getUser()).data.user;
    let { data, error } = await supabase
      .from('inspection_tags')
      .insert([{ ...clean, created_by: user?.id }])
      .select()
      .single();

    // Retry without device_uid if FK constraint fires (fk_inspection_tags_device)
    if (error && (error.code === '23503' || error.message?.includes('device_uid'))) {
      console.warn('[tagService] device_uid FK violation — retrying with device_uid=null.');
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
