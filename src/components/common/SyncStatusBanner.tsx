import React, { useEffect, useState } from 'react';
import { IonBadge, IonButton, IonIcon, IonSpinner } from '@ionic/react';
import { cloudOfflineOutline, cloudDoneOutline, syncOutline, wifiOutline } from 'ionicons/icons';
import syncService from '../../services/SyncService';

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

  const handleManualSync = async () => {
    if (!isOnline || syncing) return;
    setSyncing(true);
    await syncService.syncAll();
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