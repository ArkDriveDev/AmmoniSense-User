import React from 'react';
import { IonChip, IonIcon } from '@ionic/react';
import { cloudOfflineOutline } from 'ionicons/icons';

interface PendingSyncBadgeProps {
  label?: string;
}

export const PendingSyncBadge: React.FC<PendingSyncBadgeProps> = ({ label = 'Pending Sync' }) => {
  return (
    <IonChip
      color="warning"
      style={{
        height: '22px',
        fontSize: '11px',
        fontWeight: 600,
        margin: 0,
        padding: '0 8px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
      }}
    >
      <IonIcon icon={cloudOfflineOutline} style={{ fontSize: '13px' }} />
      {label}
    </IonChip>
  );
};

export default PendingSyncBadge;
