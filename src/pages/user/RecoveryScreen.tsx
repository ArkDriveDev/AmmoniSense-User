// RecoveryScreen.tsx — Temporary in-app recovery tool.
// Lets you create tags for orphaned sensor_data sessions and link them to the offline queue.
// Remove by setting RECOVERY_MODE = false in src/constants/recoveryConfig.ts

import React, { useCallback, useEffect, useState } from 'react';
import {
  IonBadge, IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle,
  IonContent, IonHeader, IonPage, IonSpinner, IonTitle, IonToolbar,
} from '@ionic/react';
import offlineStorage, { QueueItem } from '../../services/OfflineStorageService';
import syncService from '../../services/SyncService';

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
      </IonContent>
    </IonPage>
  );
};

export default RecoveryScreen;
