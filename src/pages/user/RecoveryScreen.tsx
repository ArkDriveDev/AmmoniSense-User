// RecoveryScreen.tsx — Temporary in-app recovery tool.
// Lets you create tags for orphaned sensor_data sessions and link them to the offline queue.
// Remove by setting RECOVERY_MODE = false in src/constants/recoveryConfig.ts

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  IonBadge, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonContent, IonHeader, IonPage, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/react';
import offlineStorage, { QueueItem } from '../../services/OfflineStorageService';
import syncService from '../../services/SyncService';

export interface SessionGroup {
  sessionId: string;
  readings: QueueItem[];
  firstTime: string;
  lastTime: string;
  minPpm: number;
  avgPpm: number;
  maxPpm: number;
  avgTemp: number;
  avgHum: number;
  avgBat: number;
  matchedTag?: QueueItem;
}

interface QueueDiagnostics {
  pendingCount: number;
  usedMb: number;
  quotaMb: number;
  usageRatio: number;
  distinctSessions: number;
  queuedTagsCount: number;
}

const RecoveryScreen: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [queueItems, setQueueItems] = useState<QueueItem[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [diag, setDiag] = useState<QueueDiagnostics>({
    pendingCount: 0, usedMb: 0, quotaMb: 0, usageRatio: 0, distinctSessions: 0, queuedTagsCount: 0,
  });

  const loadRecoveryData = useCallback(async () => {
    setLoading(true);
    try {
      const [queue, pendingCount, estimate] = await Promise.all([
        offlineStorage.getQueue(),
        syncService.getPendingCount(),
        navigator.storage?.estimate ? navigator.storage.estimate() : Promise.resolve({ usage: 0, quota: 0 }),
      ]);
      setQueueItems(queue);

      const usedMb = (estimate.usage ?? 0) / (1024 * 1024);
      const quotaMb = (estimate.quota ?? 0) / (1024 * 1024);
      const usageRatio = quotaMb > 0 ? usedMb / quotaMb : 0;

      const sessionIds = new Set<string>();
      let queuedTagsCount = 0;
      for (const item of queue) {
        if ((item.type === 'sensor_data' || item.type === 'SENSOR_READING') && item.payload?.session_id) {
          sessionIds.add(String(item.payload.session_id));
        }
        if (item.type === 'inspection_tag' || item.type === 'INSPECTION_TAG') {
          queuedTagsCount += 1;
        }
      }
      setDiag({ pendingCount, usedMb, quotaMb, usageRatio, distinctSessions: sessionIds.size, queuedTagsCount });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRecoveryData(); }, [loadRecoveryData]);

  const sessions = useMemo<SessionGroup[]>(() => {
    const tagItems = queueItems.filter((q) => q.type === 'inspection_tag' || q.type === 'INSPECTION_TAG');
    const grouped = new Map<string, QueueItem[]>();
    for (const q of queueItems) {
      if ((q.type === 'sensor_data' || q.type === 'SENSOR_READING') && q.payload?.session_id) {
        const sid = String(q.payload.session_id);
        grouped.set(sid, [...(grouped.get(sid) || []), q]);
      }
    }
    return Array.from(grouped.entries()).map(([sessionId, readings]) => {
      const sorted = [...readings].sort((a, b) => (a.payload?.created_at || a.createdAt).localeCompare(b.payload?.created_at || b.createdAt));
      const ppms = sorted.map((r) => Number(r.payload?.nh3_ppm ?? r.payload?.ammonia ?? 0));
      const temps = sorted.map((r) => Number(r.payload?.temperature ?? 0));
      const hums = sorted.map((r) => Number(r.payload?.humidity ?? 0));
      const bats = sorted.map((r) => Number(r.payload?.battery_percent ?? r.payload?.battery ?? 0));
      const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
      const readingTagIds = new Set(sorted.map((r) => r.payload?.inspection_tag_temp_id).filter(Boolean));
      const matchedTag = tagItems.find(
        (t) => t.payload?.session_id === sessionId || (t.tempId && readingTagIds.has(t.tempId)) || (t.payload?.offline_temp_id && readingTagIds.has(t.payload.offline_temp_id))
      );
      return {
        sessionId, readings: sorted,
        firstTime: sorted[0]?.payload?.created_at || sorted[0]?.createdAt || '',
        lastTime: sorted[sorted.length - 1]?.payload?.created_at || sorted[sorted.length - 1]?.createdAt || '',
        minPpm: ppms.length ? Math.min(...ppms) : 0, avgPpm: avg(ppms), maxPpm: ppms.length ? Math.max(...ppms) : 0,
        avgTemp: avg(temps), avgHum: avg(hums), avgBat: avg(bats), matchedTag,
      };
    });
  }, [queueItems]);

  const storageBadgeColor = diag.usageRatio > 0.85 ? 'danger' : diag.usageRatio >= 0.6 ? 'warning' : 'success';

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar style={{ '--background': '#1D5D9B', '--color': '#fff' }}>
          <IonTitle>Recovery Mode ({queueItems.length})</IonTitle>
          <IonButton slot="end" fill="clear" color="light" onClick={loadRecoveryData}>Refresh</IonButton>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding">
        {loading ? (
          <IonSpinner name="crescent" />
        ) : (
          <IonCard>
            <IonCardHeader>
              <IonCardTitle style={{ fontSize: '16px', fontWeight: 700 }}>1. Queue Diagnostics</IonCardTitle>
            </IonCardHeader>
            <IonCardContent style={{ display: 'grid', gap: '8px', fontSize: '14px' }}>
              <div><strong>Pending Queue Items:</strong> {diag.pendingCount}</div>
              <div>
                <strong>Storage Usage:</strong> {diag.usedMb.toFixed(2)} MB / {diag.quotaMb.toFixed(0)} MB{' '}
                <IonBadge color={storageBadgeColor}>{(diag.usageRatio * 100).toFixed(1)}%</IonBadge>
              </div>
              <div><strong>Distinct Capture Sessions:</strong> {diag.distinctSessions}</div>
              <div><strong>Queued Inspection Tags:</strong> {diag.queuedTagsCount}</div>
              {diag.usageRatio > 0.85 && (
                <div style={{ color: '#DC2626', fontWeight: 600 }}>
                  Storage is close to quota (&gt;85%). Consider saving tags without photos if needed.
                </div>
              )}
            </IonCardContent>
          </IonCard>
        )}

        {!loading && (
          <IonCard>
            <IonCardHeader>
              <IonCardTitle style={{ fontSize: '16px', fontWeight: 700 }}>2. Capture Sessions ({sessions.length})</IonCardTitle>
            </IonCardHeader>
            <IonCardContent style={{ display: 'grid', gap: '12px' }}>
              {sessions.length === 0 && <div>No sensor_data sessions found in offline queue.</div>}
              {sessions.map((s) => (
                <div key={s.sessionId} style={{ border: '1px solid #CBD5E1', borderRadius: '8px', padding: '12px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <strong>Session: {s.sessionId.slice(0, 8)}</strong>
                    <IonBadge color={s.matchedTag ? 'success' : 'warning'}>{s.matchedTag ? 'Has tag' : 'No tag'}</IonBadge>
                  </div>
                  <div><strong>Readings:</strong> {s.readings.length}</div>
                  <div><strong>Range:</strong> {s.firstTime.slice(11, 19)} – {s.lastTime.slice(11, 19)}</div>
                  <div><strong>NH3 (ppm):</strong> min {s.minPpm.toFixed(1)} / avg {s.avgPpm.toFixed(1)} / max {s.maxPpm.toFixed(1)}</div>
                  {s.matchedTag ? (
                    <div style={{ marginTop: '6px', color: '#475569' }}>
                      Tag ID: {s.matchedTag.tempId || s.matchedTag.payload?.offline_temp_id} | Site: {String(s.matchedTag.payload?.inspection_site_id || '—')} | Schedule: {String(s.matchedTag.payload?.inspection_schedule_id || '—')}
                    </div>
                  ) : (
                    <IonButton size="small" style={{ marginTop: '8px' }} onClick={() => setActiveSessionId(s.sessionId)}>
                      {activeSessionId === s.sessionId ? 'Editing Tag Below' : 'Create Tag'}
                    </IonButton>
                  )}
                </div>
              ))}
            </IonCardContent>
          </IonCard>
        )}
      </IonContent>
    </IonPage>
  );
};

export default RecoveryScreen;
