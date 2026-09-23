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
  isOffline,
});

export async function fetchSchedules(siteId?: number | string): Promise<InspectionSchedule[]> {
  let online: InspectionSchedule[] = [];
  try {
    let q = supabase.from('inspection_schedules').select('*, inspection_sites(site_name)').order('scheduled_date', { ascending: false });
    if (siteId) q = q.eq('inspection_site_id', siteId);
    const { data } = await q;
    if (data) online = data.map((d: any) => formatSched(d, false));
  } catch (err) {
    console.warn('[scheduleService] Online fetch notice:', err);
  }

  const offline = offlineStorage.getOfflineSchedules().filter((s: any) => !siteId || String(s.inspection_site_id) === String(siteId));
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
