import React from 'react';
import { IonButton, IonCard, IonCardContent, IonIcon, IonText, IonTitle } from '@ionic/react';
import { timeOutline, banOutline, logOutOutline } from 'ionicons/icons';
import { DeviceApprovalState } from '../../services/deviceApprovalService';

interface Props {
  status: Exclude<DeviceApprovalState, 'APPROVED'>;
  deviceIdentifier?: string;
  onLogout: () => void;
}

export const DeviceApprovalCard: React.FC<Props> = ({ status, deviceIdentifier, onLogout }) => {
  const isBlocked = status === 'BLOCKED';

  return (
    <IonCard className="premium-card" style={{ padding: '12px' }}>
      <IonCardContent style={{ textAlign: 'center' }}>
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: isBlocked ? 'rgba(220, 38, 38, 0.12)' : 'rgba(217, 119, 6, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '12px auto 16px auto',
          }}
        >
          <IonIcon
            icon={isBlocked ? banOutline : timeOutline}
            style={{ fontSize: '34px', color: isBlocked ? '#DC2626' : '#D97706' }}
          />
        </div>

        <IonTitle style={{ fontSize: '22px', fontWeight: 800, color: '#0F172A', padding: 0 }}>
          {isBlocked ? 'Device Blocked.' : 'Waiting for Admin Approval.'}
        </IonTitle>

        <IonText color="medium">
          <p style={{ margin: '10px 0 0 0', fontSize: '14px', lineHeight: 1.5, color: '#475569' }}>
            {isBlocked
              ? 'This device has been blocked by an administrator and cannot access AmmoniSense.'
              : 'Your device has been registered and is awaiting administrator approval before you can sign in.'}
          </p>
        </IonText>

        {deviceIdentifier && (
          <div
            style={{
              marginTop: '16px',
              padding: '8px 12px',
              borderRadius: '8px',
              background: '#F1F5F9',
              fontSize: '12px',
              fontFamily: 'monospace',
              color: '#475569',
              wordBreak: 'break-all',
            }}
          >
            Device ID: {deviceIdentifier}
          </div>
        )}

        <IonButton
          expand="block"
          color={isBlocked ? 'danger' : 'primary'}
          className="btn-ammoni"
          onClick={onLogout}
          style={{ marginTop: '24px' }}
        >
          <IonIcon icon={logOutOutline} slot="start" />
          Logout
        </IonButton>
      </IonCardContent>
    </IonCard>
  );
};

export default DeviceApprovalCard;

