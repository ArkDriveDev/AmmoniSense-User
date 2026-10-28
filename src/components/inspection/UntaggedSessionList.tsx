import React, { useEffect, useState } from 'react';
import { IonBadge, IonButton, IonCard, IonCardContent, IonIcon, IonSpinner } from '@ionic/react';
import { arrowBackOutline } from 'ionicons/icons';
import offlineStorage, { QueueItem } from '../../services/OfflineStorageService';
import { RECOVERY_MODE } from '../../constants/recovery';

export interface UntaggedSessionOption {
  sessionId: string;
  readingQueueIds: string[];
  readingCount: number;
  firstTime: string;
  lastTime: string;
  minPpm: number;
  avgPpm: number;
  maxPpm: number;
  avgTemp: number | null;
  avgHum: number | null;
  avgBat: number | null;
  deviceUid: string;
  firstLat?: number;
  firstLng?: number;
}

interface Props {
  onSelect: (session: UntaggedSessionOption) => void;
  onBack: () => void;
}

export const UntaggedSessionList: React.FC<Props> = ({ onSelect, onBack }) => {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<UntaggedSessionOption[]>([]);
  const [orphanDiag, setOrphanDiag] = useState<{ sessionId: string; count: number; danglingTagId: string }[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const queue = await offlineStorage.getQueue();
        const tagItems = queue.filter((q) => q.type === 'inspection_tag' || q.type === 'INSPECTION_TAG');
        const ownedSessionIds = new Set(tagItems.map((t) => String(t.payload?.session_id || '')).filter(Boolean));
        const ownedTagTempIds = new Set(tagItems.flatMap((t) => [t.tempId, t.payload?.temp_id, t.payload?.offline_temp_id]).filter(Boolean).map(String));
        if (RECOVERY_MODE) {
          const orphanGroups = new Map<string, { count: number; danglingTagId: string }>();
          for (const q of queue) {
            if (q.type === 'sensor_data') {
              const ref = String(q.payload?.inspection_tag_temp_id || '');
              if (!ref || !ownedTagTempIds.has(ref)) {
                const sid = String(q.payload?.session_id || 'unknown');
                const cur = orphanGroups.get(sid) || { count: 0, danglingTagId: ref || 'none' };
                orphanGroups.set(sid, { count: cur.count + 1, danglingTagId: cur.danglingTagId });
              }
            }
          }
          const diagList = Array.from(orphanGroups.entries()).map(([sessionId, v]) => ({ sessionId, ...v }));
          console.log('[RECOVERY DIAGNOSTIC] Orphaned sensor_data by session_id:', diagList);
          setOrphanDiag(diagList);
        }
        const grouped = new Map<string, QueueItem[]>();
        for (const q of queue) {
          if ((q.type === 'sensor_data' || q.type === 'SENSOR_READING') && q.payload?.session_id) {
            const sid = String(q.payload.session_id);
            grouped.set(sid, [...(grouped.get(sid) || []), q]);
          }
        }
        const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
        const untagged: UntaggedSessionOption[] = [];
        for (const [sessionId, items] of grouped.entries()) {
          if (ownedSessionIds.has(sessionId) || items.some((r) => r.payload?.inspection_tag_temp_id && ownedTagTempIds.has(String(r.payload.inspection_tag_temp_id)))) continue;
          const sorted = [...items].sort((a, b) => String(a.payload?.created_at || a.createdAt).localeCompare(String(b.payload?.created_at || b.createdAt)));
          const ppms = sorted.map((r) => Number(r.payload?.nh3_ppm ?? r.payload?.ammonia ?? 0));
          const temps = sorted.map((r) => r.payload?.temperature).filter((v) => v !== null && v !== undefined).map(Number);
          const hums = sorted.map((r) => r.payload?.humidity).filter((v) => v !== null && v !== undefined).map(Number);
          const bats = sorted.map((r) => r.payload?.battery_percent ?? r.payload?.battery).filter((v) => v !== null && v !== undefined).map(Number);
          const first = sorted[0]?.payload || {};
          untagged.push({
            sessionId, readingQueueIds: sorted.map((r) => r.id), readingCount: sorted.length,
            firstTime: String(first.created_at || sorted[0]?.createdAt || ''),
            lastTime: String(sorted[sorted.length - 1]?.payload?.created_at || sorted[sorted.length - 1]?.createdAt || ''),
            minPpm: ppms.length ? Math.min(...ppms) : 0, avgPpm: avg(ppms), maxPpm: ppms.length ? Math.max(...ppms) : 0,
            avgTemp: temps.length ? avg(temps) : null, avgHum: hums.length ? avg(hums) : null, avgBat: bats.length ? avg(bats) : null,
            deviceUid: String(first.device_uid || ''),
            firstLat: first.latitude ? Number(first.latitude) : undefined, firstLng: first.longitude ? Number(first.longitude) : undefined,
          });
        }
        setSessions(untagged);
      } finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: '24px' }}><IonSpinner name="crescent" /></div>;

  return (
    <div style={{ display: 'grid', gap: '10px' }}>
      {RECOVERY_MODE && (
        <div style={{ padding: '8px 12px', background: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: '#92400E' }}>
          <div>Recovery mode active</div>
          {orphanDiag.length > 0 && (
            <div style={{ marginTop: '4px', fontSize: '11px', fontWeight: 400 }}>
              Orphaned sessions: {orphanDiag.map((d) => `${d.sessionId.slice(0, 8)} (${d.count} rows → ${d.danglingTagId.slice(0, 14)})`).join(', ')}
            </div>
          )}
        </div>
      )}
      <h4 style={{ margin: 0, fontWeight: 700 }}>Select Untagged Session</h4>
      {sessions.length === 0 ? (
        <div style={{ padding: '16px', background: '#F8FAFC', borderRadius: '8px', textAlign: 'center', color: '#475569' }}>No untagged sessions available.</div>
      ) : (
        sessions.map((s) => (
          <IonCard key={s.sessionId} button onClick={() => onSelect(s)} style={{ margin: 0, border: '1px solid #CBD5E1' }}>
            <IonCardContent style={{ padding: '12px', fontSize: '13px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <strong>Session {s.sessionId.slice(0, 8)}</strong>
                <IonBadge color="warning">Untagged</IonBadge>
              </div>
              <div><strong>Readings:</strong> {s.readingCount} ({s.firstTime.slice(11, 19)} – {s.lastTime.slice(11, 19)})</div>
              <div><strong>PPM:</strong> min {s.minPpm.toFixed(1)} / avg {s.avgPpm.toFixed(1)} / max {s.maxPpm.toFixed(1)}</div>
            </IonCardContent>
          </IonCard>
        ))
      )}
      <IonButton fill="outline" onClick={onBack}><IonIcon icon={arrowBackOutline} slot="start" /> Back</IonButton>
    </div>
  );
};

export default UntaggedSessionList;
