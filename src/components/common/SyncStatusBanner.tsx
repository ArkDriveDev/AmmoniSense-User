import React, { useEffect, useState } from 'react';
import { IonBadge, IonButton, IonIcon, IonSpinner } from '@ionic/react';
import { cloudOfflineOutline, cloudDoneOutline, syncOutline, wifiOutline } from 'ionicons/icons';
import syncService from '../../services/SyncService';
import { showToast } from '../../utils/toast';

export const SyncStatusBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(syncService.isOnline());
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');

  useEffect(() => {
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
    showToast({ message: '🔄 Initiating re-sync with server...', color: 'primary', duration: 2000 });
    await syncService.resync();
    setSyncing(false);
  };

  return (
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

      {isOnline && !syncing && (
        <IonButton
          fill="clear"
          size="small"
          onClick={handleResync}
          style={{
            height: '22px',
            fontSize: '11px',
            margin: '0 0 0 2px',
            padding: '0 4px',
            '--color': pendingCount > 0 ? '#854d0e' : '#15803d',
            fontWeight: 700,
            textTransform: 'none',
          }}
          title="Trigger re-sync"
        >
          <IonIcon icon={syncOutline} slot="start" style={{ fontSize: '13px', marginRight: '3px' }} />
          {pendingCount > 0 ? `Sync (${pendingCount})` : 'Re-sync'}
        </IonButton>
      )}

      {syncing && <IonSpinner name="crescent" style={{ width: '14px', height: '14px' }} />}
    </div>
  );
};

export default SyncStatusBanner;
