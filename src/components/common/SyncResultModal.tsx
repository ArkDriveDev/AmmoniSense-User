import React, { useState } from 'react';
import { IonModal, IonHeader, IonToolbar, IonTitle, IonButtons, IonButton, IonContent, IonIcon } from '@ionic/react';
import { closeOutline, copyOutline, checkmarkOutline, alertCircleOutline } from 'ionicons/icons';
import { QueueItem } from '../../services/OfflineStorageService';

interface SyncResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  failedItems: QueueItem[];
}

export const SyncResultModal: React.FC<SyncResultModalProps> = ({ isOpen, onClose, failedItems }) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const getEffectiveTempId = (item: QueueItem): string => {
    return item.tempId || item.payload?.temp_id || item.payload?.offline_temp_id || item.id;
  };

  const copyToClipboard = (item: QueueItem) => {
    const text = `Type: ${item.type}\nTemp ID: ${getEffectiveTempId(item)}\nError: ${item.errorMsg || 'Unknown error'}`;
    navigator.clipboard?.writeText(text);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      <IonHeader>
        <IonToolbar color="danger">
          <IonTitle>Sync Results & Failures</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose}><IonIcon icon={closeOutline} /></IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding" style={{ '--background': '#f8fafc' }}>
        <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: '#b91c1c' }}>
          <IonIcon icon={alertCircleOutline} style={{ fontSize: '24px' }} />
          <span style={{ fontWeight: 600 }}>{failedItems.length} item(s) failed during synchronization:</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {failedItems.map((item) => (
            <div key={item.id} style={{ background: '#fff', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b', textTransform: 'uppercase' }}>{item.type}</span>
                <span style={{ fontSize: '11px', color: '#64748b', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>{getEffectiveTempId(item)}</span>
              </div>
              <div style={{ fontSize: '12px', color: '#b91c1c', background: '#fef2f2', padding: '8px', borderRadius: '6px', wordBreak: 'break-word', fontFamily: 'monospace' }}>
                {item.errorMsg || 'Unknown synchronization error'}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <IonButton size="small" fill="outline" color={copiedId === item.id ? 'success' : 'medium'} onClick={() => copyToClipboard(item)}>
                  <IonIcon slot="start" icon={copiedId === item.id ? checkmarkOutline : copyOutline} />
                  {copiedId === item.id ? 'Copied' : 'Copy Error'}
                </IonButton>
              </div>
            </div>
          ))}
        </div>
      </IonContent>
    </IonModal>
  );
};

export default SyncResultModal;
