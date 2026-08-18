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
