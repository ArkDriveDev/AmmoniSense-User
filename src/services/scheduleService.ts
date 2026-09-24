import { supabase } from './supabase';
import offlineStorage from './OfflineStorageService';
import { InspectionSchedule, CreateSchedulePayload, toUpperClean } from '../types/inspection';

const formatSched = (d: any, isOffline = false): InspectionSchedule => ({
  id: d.id,
  inspection_site_id: d.inspection_site_id,
  schedule_name: d.schedule_name,
  scheduled_date: d.scheduled_date,
  scheduled_time: d.scheduled_time,
  status: d.status || 'PENDING',
  notes: d.notes,
  assigned_to: d.assigned_to,
  created_by: d.created_by,
  created_at: d.created_at,
  site_name: d.inspection_sites?.site_name,
  tags_count: d.tags_count ?? (Array.isArray(d.inspection_tags) ? d.inspection_tags.length : 0),
  isOffline,
});

export async function fetchSchedules(siteId?: number | string): Promise<InspectionSchedule[]> {
  let online: InspectionSchedule[] = [];
  try {
    let q = supabase.from('inspection_schedules').select('*, inspection_sites(site_name)').order('scheduled_date', { ascending: false });
    if (siteId) q = q.eq('inspection_site_id', siteId);
    const { data } = await q;
    if (data) {
      online = data.map((d: any) => formatSched(d, false));

      const schedIds = online.map(s => s.id);
      if (schedIds.length > 0) {
        const { data: tagRows } = await supabase
          .from('inspection_tags')
          .select('id, inspection_schedule_id')
          .in('inspection_schedule_id', schedIds);

        if (tagRows) {
          const counts: Record<string, number> = {};
          tagRows.forEach((r: any) => {
            if (r.inspection_schedule_id) {
              const k = String(r.inspection_schedule_id);
              counts[k] = (counts[k] || 0) + 1;
            }
          });
          online.forEach((s) => {
            s.tags_count = counts[String(s.id)] || 0;
          });
        }
      }
    }
  } catch (err) {
    console.warn('[scheduleService] Online fetch notice:', err);
  }

  const offline = offlineStorage.getOfflineSchedules().filter((s: any) => !siteId || String(s.inspection_site_id) === String(siteId));
  const offlineTags = offlineStorage.getOfflineTags?.() || [];
  offline.forEach((os: any) => {
    os.tags_count = offlineTags.filter((ot: any) => String(ot.inspection_schedule_id) === String(os.id)).length;
  });

  online.forEach((s) => {
    const pendingCount = offlineTags.filter((ot: any) => String(ot.inspection_schedule_id) === String(s.id)).length;
    s.tags_count = (s.tags_count || 0) + pendingCount;
  });

  const onlineIds = new Set(online.map((s) => String(s.id)));
  return [...offline.filter((s: any) => !onlineIds.has(String(s.id))), ...online];
}

export async function fetchScheduleById(id: number | string): Promise<InspectionSchedule | null> {
  const local = offlineStorage.getOfflineSchedules().find((s: any) => String(s.id) === String(id));
  if (local) return local;
  try {
    const { data } = await supabase.from('inspection_schedules').select('*, inspection_sites(site_name)').eq('id', id).maybeSingle();
    return data ? formatSched(data, false) : null;
  } catch {
    return null;
  }
}

export async function createSchedule(payload: CreateSchedulePayload): Promise<InspectionSchedule> {
  const clean = {
    inspection_site_id: payload.inspection_site_id,
    schedule_name: toUpperClean(payload.schedule_name),
    scheduled_date: payload.scheduled_date,
    scheduled_time: payload.scheduled_time,
    notes: toUpperClean(payload.notes),
    status: payload.status || 'PENDING',
    assigned_to: payload.assigned_to,
  };

  try {
    const user = (await supabase.auth.getUser()).data.user;
    const { data, error } = await supabase.from('inspection_schedules').insert([{ ...clean, created_by: user?.id }]).select().single();
    if (!error && data) {
      window.dispatchEvent(new CustomEvent('schedules_updated'));
      return formatSched(data, false);
    }
  } catch (err) {
    console.warn('[scheduleService] Network offline, saving queue:', err);
  }

  const tempId = `temp_sched_${Date.now()}`;
  const offlineRec = formatSched({ ...clean, id: tempId, created_at: new Date().toISOString() }, true);
  offlineStorage.saveOfflineSchedule(offlineRec);
  await offlineStorage.enqueueItem('INSPECTION_SCHEDULE', { ...clean, temp_id: tempId });
  window.dispatchEvent(new CustomEvent('schedules_updated'));
  return offlineRec;
}

export async function deleteSchedule(scheduleId: string | number): Promise<void> {
  const strId = String(scheduleId);
  const isTemp = strId.startsWith('temp_sched_');

  // 1. Clean offline tags whose schedule matches
  const keptTags = offlineStorage.getOfflineTags().filter(
    (t: any) => String(t.inspection_schedule_id) !== strId
  );
  localStorage.setItem('offline_inspection_tags', JSON.stringify(keptTags));

  // 2. Remove the offline schedule entry
  offlineStorage.removeOfflineSchedule(strId);

  // 3. Purge any queued items referencing this schedule
  try {
    const queue = await offlineStorage.getQueue();
    for (const item of queue) {
      const p = item.payload || {};
      if (String(p.temp_id) === strId || String(p.id) === strId || String(p.inspection_schedule_id) === strId) {
        await offlineStorage.removeQueueItem(item.id);
      }
    }
  } catch (e) {
    console.warn('[scheduleService] Queue purge notice:', e);
  }

  // 4. Delete from Supabase if it's a real (numeric) ID
  if (!isTemp) {
    try {
      await supabase.from('inspection_tags').delete().eq('inspection_schedule_id', scheduleId);
      const { error } = await supabase.from('inspection_schedules').delete().eq('id', scheduleId);
      if (error) throw new Error(error.message);
    } catch (err) {
      console.error('[scheduleService] Supabase delete error:', err);
      throw err;
    }
  }

  window.dispatchEvent(new CustomEvent('schedules_updated'));
}

export async function updateSchedule(scheduleId: number | string, updates: Partial<CreateSchedulePayload>): Promise<void> {
  const clean: any = {};
  if (updates.schedule_name !== undefined) clean.schedule_name = toUpperClean(updates.schedule_name);
  if (updates.scheduled_date !== undefined) clean.scheduled_date = updates.scheduled_date;
  if (updates.scheduled_time !== undefined) clean.scheduled_time = updates.scheduled_time;
  if (updates.notes !== undefined) clean.notes = toUpperClean(updates.notes);
  if (updates.status !== undefined) clean.status = updates.status;
  if (updates.assigned_to !== undefined) clean.assigned_to = updates.assigned_to;

  const isOffline = typeof scheduleId === 'string' && scheduleId.startsWith('temp_');
  if (!isOffline && navigator.onLine) {
    const { error } = await supabase.from('inspection_schedules').update(clean).eq('id', scheduleId);
    if (error) throw error;
  } else {
    const all = offlineStorage.getOfflineSchedules();
    const target = all.find((s: any) => String(s.id) === String(scheduleId));
    if (target) {
      Object.assign(target, clean);
      offlineStorage.saveOfflineSchedule(target);
    }
  }
  window.dispatchEvent(new CustomEvent('schedules_updated'));
}

