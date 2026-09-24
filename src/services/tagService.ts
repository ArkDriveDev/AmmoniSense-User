import { supabase } from './supabase';
import offlineStorage from './OfflineStorageService';
import { InspectionTag, CreateTagPayload, calculateAmmoniaStatus, toUpperClean } from '../types/inspection';
import { getSignedPhotoUrl } from './photoStorageService';
import { autoRegisterDevice } from './deviceService';

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
    photo_thumbnail_url: d.photo_thumbnail_url,
    device_uid: d.device_uid || sensor.device_uid || null,
    sensor_data_id: d.sensor_data_id ?? sensor.id ?? null,
    inspection_schedule_id: d.inspection_schedule_id,
    inspection_site_id: d.inspection_site_id ?? null,
    notes: d.notes,
    offline_temp_id: d.offline_temp_id ?? null,
    created_by: d.created_by,
    created_at: d.created_at,
    isOffline,
  };
};

export async function fetchTags(filter?: { scheduleId?: number | string; siteId?: number | string }): Promise<InspectionTag[]> {
  let online: InspectionTag[] = [];
  try {
    let q = supabase.from('inspection_tags').select('*, sensor_data(*)').order('created_at', { ascending: false });
    if (filter?.scheduleId) q = q.eq('inspection_schedule_id', filter.scheduleId);
    if (filter?.siteId) q = q.eq('inspection_site_id', filter.siteId);
    let { data, error } = await q;
    if (error) {
      console.warn('[tagService] sensor_data join notice, falling back:', error.message);
      let fallbackQ = supabase.from('inspection_tags').select('*').order('created_at', { ascending: false });
      if (filter?.scheduleId) fallbackQ = fallbackQ.eq('inspection_schedule_id', filter.scheduleId);
      if (filter?.siteId) fallbackQ = fallbackQ.eq('inspection_site_id', filter.siteId);
      const res = await fallbackQ;
      data = res.data;
    }
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
    sensor_data_id: payload.sensor_data_id ? Number(payload.sensor_data_id) : null,
    inspection_schedule_id: payload.inspection_schedule_id,
    inspection_site_id: resolvedSiteId,
    notes: toUpperClean(payload.notes),
    offline_temp_id: payload.offline_temp_id || null,
  };

  try {
    const user = (await supabase.auth.getUser()).data.user;

    // Step 1: Always create a sensor_data row
    let sensorDataId: number | null = clean.sensor_data_id;
    try {
      const devUid = clean.device_uid || 'MANUAL-ENTRY';
      await autoRegisterDevice(devUid);

      const { data: sRec, error: sErr } = await supabase
        .from('sensor_data')
        .insert([{
          device_uid: devUid,
          ammonia: clean.ammonia,
          temperature: clean.temperature,
          humidity: clean.humidity,
          battery: clean.battery,
          latitude: clean.latitude,
          longitude: clean.longitude,
          status: clean.status || calculateAmmoniaStatus(clean.ammonia ?? 0),
          submitted_by: user?.id || null,
        }])
        .select('id')
        .single();

      if (!sErr && sRec?.id) {
        sensorDataId = sRec.id;
        clean.sensor_data_id = sRec.id;
      }
    } catch (e: any) {
      console.warn('[tagService] sensor_data insert failed, tag will have no reading link:', e?.message);
    }

    // Step 2: Save tag WITHOUT reading values
    const tagPayload: any = {
      tag_name: clean.tag_name || 'TAG',
      inspection_schedule_id: clean.inspection_schedule_id || null,
      inspection_site_id: clean.inspection_site_id || null,
      sensor_data_id: sensorDataId,
      device_uid: clean.device_uid || null,
      latitude: clean.latitude ?? null,
      longitude: clean.longitude ?? null,
      photo_url: clean.photo_url ?? null,
      photo_thumbnail_url: clean.photo_thumbnail_url ?? null,
      notes: clean.notes || null,
      offline_temp_id: clean.offline_temp_id || null,
      created_by: user?.id,
    };

    let { data, error } = await supabase
      .from('inspection_tags')
      .insert([tagPayload])
      .select()
      .single();

    // Resilient FK retry handling:
    if (error && (error.code === '23503' || error.code === '22P02')) {
      console.warn('[tagService] FK constraint error on tag insert — retrying with safe fallbacks:', error.message);
      for (const fk of ['sensor_data_id', 'inspection_site_id', 'device_uid'] as const) {
        if (error && tagPayload[fk]) {
          tagPayload[fk] = null;
          const res = await supabase.from('inspection_tags').insert([tagPayload]).select().single();
          data = res.data; error = res.error;
        }
      }
      if (error) {
        const res = await supabase.from('inspection_tags').insert([{
          ...tagPayload,
          inspection_schedule_id: null,
          inspection_site_id: null,
          device_uid: null,
          sensor_data_id: null,
        }]).select().single();
        data = res.data; error = res.error;
      }
    }

    if (error && error.code === '23505') {
      console.warn('[tagService] Duplicate tag detected, treating as saved.');
      window.dispatchEvent(new CustomEvent('tags_updated'));
      return formatTag({ ...clean, id: Date.now() }, false);
    }

    if (!error && data) {
      window.dispatchEvent(new CustomEvent('tags_updated'));
      return formatTag({ ...clean, ...data }, false);
    }
  } catch (err) {
    console.warn('[tagService] Network offline, saving tag to queue:', err);
  }

  const tempId = `temp_tag_${Date.now()}`;
  const offlineRec = formatTag({ ...clean, id: tempId, offline_temp_id: tempId, created_at: new Date().toISOString() }, true);
  offlineStorage.saveOfflineTag(offlineRec);
  await offlineStorage.enqueueItem('INSPECTION_TAG', { ...clean, temp_id: tempId, offline_temp_id: tempId });
  window.dispatchEvent(new CustomEvent('tags_updated'));
  return offlineRec;
}
