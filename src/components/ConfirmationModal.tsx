import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonText
} from '@ionic/react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: string;
}

export default function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmColor = 'danger'
}: ConfirmationModalProps) {
  return (
    <IonModal isOpen={isOpen} onDidDismiss={onClose}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>{title}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={onClose}>Close</IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <IonText>
            <p style={{ fontSize: '18px' }}>{message}</p>
          </IonText>

          <div style={{ display: 'flex', gap: '10px', marginTop: '30px', justifyContent: 'center' }}>
            <IonButton fill="outline" onClick={onClose}>
              {cancelText}
            </IonButton>
            <IonButton color={confirmColor} onClick={() => {
              onConfirm();
              onClose();
            }}>
              {confirmText}
            </IonButton>
          </div>
        </div>
      </IonContent>
    </IonModal>
  );
}