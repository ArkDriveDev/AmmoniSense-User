import React, { useEffect, useState } from 'react';
import { IonBadge, IonButton, IonIcon, IonSpinner } from '@ionic/react';
import { cloudOfflineOutline, cloudDoneOutline, syncOutline, wifiOutline } from 'ionicons/icons';
import syncService from '../../services/SyncService';
import sitesCacheService from '../../services/sitesCacheService';
import offlineStorage, { QueueItem } from '../../services/OfflineStorageService';
import { SyncResultModal } from './SyncResultModal';
import { showToast } from '../../utils/toast';

export const SyncStatusBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(syncService.isOnline());
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);
  const [showResultModal, setShowResultModal] = useState<boolean>(false);
  const [failedItems, setFailedItems] = useState<QueueItem[]>([]);

  useEffect(() => {
    sitesCacheService.getLastSyncedAt().then((ts) => {
      if (ts) setLastSyncedTime(new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    });
    const unsubscribe = syncService.subscribe((evt) => {
      setIsOnline(evt.isOnline);
      setPendingCount(evt.pendingCount);

      if (evt.type === 'sync_start' || evt.type === 'sync_progress') {
        setSyncing(true);
        setStatusMsg(evt.message || 'Syncing offline data...');
      } else if (evt.type === 'sync_complete' || evt.type === 'sync_error') {
        setSyncing(false);
        setStatusMsg('');
      }
    });

    return () => unsubscribe();
  }, []);

  const handleResync = async () => {
    if (!isOnline) {
      showToast({ message: 'Cannot sync while offline. Check internet connection.', color: 'warning' });
      return;
    }
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await syncService.resync();
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setLastSyncedTime(timeStr);
      if (res.failed > 0) {
        const queue = await offlineStorage.getQueue();
        const failed = queue.filter((i) => i.status === 'failed');
        setFailedItems(failed);
        setShowResultModal(true);
        showToast({ message: `⚠️ Sync completed with ${res.failed} error(s). Review details in the popup.`, color: 'warning', duration: 4000 });
      } else {
        showToast({ message: `🎉 Synced successfully! Last synced at ${timeStr}.`, color: 'success', duration: 3500 });
      }
    } catch (err: any) {
      showToast({ message: `Sync failed: ${err.message || 'Error'}. Press Sync Now to retry.`, color: 'danger', duration: 4000 });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <>
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '12px',
        fontWeight: 600,
        padding: '4px 10px',
        borderRadius: '20px',
        backgroundColor: !isOnline
          ? '#fff7ed'
          : pendingCount > 0
          ? '#fefce8'
          : '#f0fdf4',
        border: `1px solid ${
          !isOnline
            ? '#fed7aa'
            : pendingCount > 0
            ? '#fef08a'
            : '#bbf7d0'
        }`,
        color: !isOnline
          ? '#c2410c'
          : pendingCount > 0
          ? '#854d0e'
          : '#15803d',
        transition: 'all 0.3s ease',
      }}
    >
      <IonIcon
        icon={
          !isOnline
            ? cloudOfflineOutline
            : syncing
            ? syncOutline
            : pendingCount > 0
            ? cloudDoneOutline
            : wifiOutline
        }
        style={{
          fontSize: '15px',
          animation: syncing ? 'spin 1.5s linear infinite' : 'none',
        }}
      />

      <span>
        {!isOnline
          ? `Offline Mode ${pendingCount > 0 ? `(${pendingCount} pending)` : ''}`
          : syncing
          ? statusMsg || 'Syncing...'
          : pendingCount > 0
          ? `${pendingCount} queued`
          : 'Online'}
      </span>

      <IonButton
        fill="solid"
        size="small"
        onClick={handleResync}
        disabled={syncing || !isOnline}
        style={{
          height: '24px',
          fontSize: '11px',
          margin: '0 0 0 4px',
          padding: '0 8px',
          '--background': '#ffffff',
          '--color': '#0F3C5C',
          fontWeight: 700,
          textTransform: 'none',
          borderRadius: '12px',
        }}
        title="Sync offline records to server"
      >
        {syncing ? (
          <>
            <IonSpinner name="crescent" style={{ width: '12px', height: '12px', marginRight: '4px' }} />
            Syncing...
          </>
        ) : (
          <>
            <IonIcon icon={syncOutline} slot="start" style={{ fontSize: '13px', marginRight: '3px' }} />
            {pendingCount > 0 ? `Sync Now (${pendingCount})` : 'Sync Now'}
          </>
        )}
      </IonButton>
    </div>
    <SyncResultModal
      isOpen={showResultModal}
      onClose={() => setShowResultModal(false)}
      failedItems={failedItems}
    />
    </>
  );
};

export default SyncStatusBanner;
