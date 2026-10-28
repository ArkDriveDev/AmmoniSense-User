import { supabase } from './supabase';
import offlineStorage from './OfflineStorageService';
import { InspectionSchedule, CreateSchedulePayload, toUpperClean } from '../types/inspection';
import { isOnline, withTimeout } from '../utils/networkUtils';

const formatSched = (d: any, isOffline = false): InspectionSchedule => ({
  id: d.id,
  inspection_site_id: d.inspection_site_id,
  schedule_name: d.schedule_name,
  scheduled_date: d.scheduled_date,
  scheduled_time: d.scheduled_time ?? null,
  status: d.status || 'SCHEDULED',
  started_at: d.started_at ?? null,
  completed_at: d.completed_at ?? null,
  created_by: d.created_by ?? null,
  created_at: d.created_at,
  updated_at: d.updated_at,
  notes: d.notes ?? null,
  offline_temp_id: d.offline_temp_id ?? (String(d.id).startsWith('temp_') ? String(d.id) : null),
  site_name: d.site_name || d.inspection_sites?.site_name,
  tags_count: d.tags_count ?? (Array.isArray(d.inspection_tags) ? d.inspection_tags.length : 0),
  isOffline,
});

export async function fetchSchedules(siteId?: number | string): Promise<InspectionSchedule[]> {
  const idbSchedules = await offlineStorage.getAllSchedulesFromIDB(siteId);

  const formatList = (raw: any[]) => {
    const offlineTags = offlineStorage.getOfflineTags?.() || [];
    return raw.map((d: any) => {
      const isOffline = Boolean(d.isOffline || d.offline_temp_id || String(d.id).startsWith('temp_'));
      const item = formatSched(d, isOffline);
      const pendingCount = offlineTags.filter((ot: any) => String(ot.inspection_schedule_id) === String(item.id)).length;
      item.tags_count = (item.tags_count || 0) + pendingCount;
      return item;
    });
  };

  if (isOnline()) {
    (async () => {
      try {
        let q = supabase.from('inspection_schedules').select('*, inspection_sites(site_name)').order('scheduled_date', { ascending: false });
        if (siteId) q = q.eq('inspection_site_id', siteId);
        const { data, error } = await withTimeout<any>(q, 3500);
        if (!error && Array.isArray(data)) {
          const formatted = data.map((d: any) => formatSched(d, false));
          const schedIds = formatted.map((s) => s.id);
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
              formatted.forEach((s) => {
                s.tags_count = counts[String(s.id)] || 0;
              });
            }
          }
          await offlineStorage.upsertSchedulesToIDB(formatted);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('schedules_updated'));
          }
        }
      } catch (err) {
        console.warn('[scheduleService] Background Supabase fetch failed:', err);
      }
    })();
  }

  return formatList(idbSchedules);
}

export async function fetchScheduleById(id: number | string): Promise<InspectionSchedule | null> {
  const local = offlineStorage.getOfflineSchedules().find(
    (s: any) => String(s.id) === String(id) || (s.offline_temp_id && String(s.offline_temp_id) === String(id))
  );
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
    status: payload.status || 'SCHEDULED',
  };

  const siteIdStr = String(clean.inspection_site_id);
  const isTempSite = siteIdStr.startsWith('temp_') || siteIdStr.startsWith('queue_');

  if (isOnline() && !isTempSite) {
    try {
      const user = offlineStorage.getSession()?.session?.user || (await withTimeout<any>(supabase.auth.getUser(), 3000)).data?.user;
      const { data, error } = await withTimeout<any>(
        supabase.from('inspection_schedules').insert([{ ...clean, created_by: user?.id }]).select('*, inspection_sites(site_name)').single(),
        3500
      );
      if (!error && data) {
        window.dispatchEvent(new CustomEvent('schedules_updated'));
        return formatSched(data, false);
      }
    } catch (err) {
      console.warn('[scheduleService] Network offline/slow, saving to offline queue:', err);
    }
  }

  const tempId = `temp_sched_${Date.now()}`;
  let siteName: string | undefined;
  if (isTempSite) {
    const offlineSites = await offlineStorage.getOfflineSites().catch(() => []);
    const matchingOfflineSite = offlineSites.find((s) => String(s.id) === siteIdStr || s.site_code === siteIdStr);
    siteName = matchingOfflineSite?.site_name;
  }
  if (!siteName) {
    const cachedSite = offlineStorage.getCachedSiteById(clean.inspection_site_id);
    siteName = cachedSite?.site_name;
  }

  const offlineRec = formatSched({
    ...clean,
    id: tempId,
    offline_temp_id: tempId,
    site_name: siteName,
    created_at: new Date().toISOString()
  }, true);

  offlineStorage.saveOfflineSchedule(offlineRec);
  await offlineStorage.enqueueItem('inspection_schedule', {
    ...clean,
    temp_id: tempId,
    offline_temp_id: tempId,
    site_name: siteName,
  }, {
    action: 'insert',
    tempId,
  });
  window.dispatchEvent(new CustomEvent('schedules_updated'));
  return offlineRec;
}

export async function deleteSchedule(scheduleId: string | number): Promise<void> {
  const strId = String(scheduleId);
  const isTemp = strId.startsWith('temp_sched_') || strId.startsWith('temp_');

  // Offline schedule: purge local copies and queued items without Supabase call
  if (isTemp) {
    await offlineStorage.deleteScheduleAndChildren(strId);
    return;
  }

  // Synced schedule: delete from Supabase first
  try {
    await supabase.from('inspection_tags').delete().eq('inspection_schedule_id', scheduleId);
    const { error } = await supabase.from('inspection_schedules').delete().eq('id', scheduleId);
    if (error) throw new Error(error.message);
  } catch (err) {
    console.error('[scheduleService] Supabase delete error:', err);
    throw err;
  }

  // Purge local copies and queued children
  await offlineStorage.deleteScheduleAndChildren(strId);
}

export async function updateSchedule(scheduleId: number | string, updates: Partial<CreateSchedulePayload>): Promise<void> {
  const clean: any = {};
  if (updates.schedule_name !== undefined) clean.schedule_name = toUpperClean(updates.schedule_name);
  if (updates.scheduled_date !== undefined) clean.scheduled_date = updates.scheduled_date;
  if (updates.scheduled_time !== undefined) clean.scheduled_time = updates.scheduled_time;
  if (updates.notes !== undefined) clean.notes = toUpperClean(updates.notes);
  if (updates.status !== undefined) clean.status = updates.status;

  const isOffline = typeof scheduleId === 'string' && scheduleId.startsWith('temp_');
  let synced = false;

  if (!isOffline && navigator.onLine) {
    try {
      const { error } = await supabase.from('inspection_schedules').update(clean).eq('id', scheduleId);
      if (!error) synced = true;
      else console.warn('[scheduleService] Supabase schedule update failed, queueing offline:', error);
    } catch (err) {
      console.warn('[scheduleService] Network failed during schedule update, queueing offline:', err);
    }
  }

  // Update local cache if present
  const all = offlineStorage.getOfflineSchedules();
  const target = all.find((s: any) => String(s.id) === String(scheduleId));
  if (target) {
    Object.assign(target, clean);
    offlineStorage.saveOfflineSchedule(target);
  }

  // If not synced directly to Supabase, enqueue or update in offline queue
  if (!synced) {
    const queue = await offlineStorage.getQueue();
    const strId = String(scheduleId);
    const existingQueueItem = queue.find((q) =>
      q.tempId === strId || q.payload?.temp_id === strId || (q.targetId && String(q.targetId) === strId)
    );

    if (existingQueueItem && existingQueueItem.action === 'insert') {
      const updatedPayload = { ...existingQueueItem.payload, ...clean };
      await offlineStorage.updateQueueItemPayload(existingQueueItem.id, updatedPayload);
    } else {
      await offlineStorage.enqueueItem('inspection_schedule', clean, {
        action: 'update',
        targetId: !isOffline ? Number(scheduleId) : null,
        tempId: isOffline ? strId : null,
      });
    }
  }

  window.dispatchEvent(new CustomEvent('schedules_updated'));
}

