import React, { useState } from 'react';
import {
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonCard,
  IonCardContent,
  IonItem,
  IonLabel,
  IonRange,
  IonIcon,
  IonBadge,
  IonGrid,
  IonRow,
  IonCol
} from '@ionic/react';
import {
  bluetoothOutline,
  closeOutline,
  radioOutline,
  flashOutline,
  alertCircleOutline,
  checkmarkCircleOutline,
  warningOutline,
  refreshOutline
} from 'ionicons/icons';
import bleService, { BLEReading } from '../../services/bleService';

interface BLESimulatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSimulatedReading?: (reading: BLEReading) => void;
}

export const BLESimulatorModal: React.FC<BLESimulatorModalProps> = ({
  isOpen,
  onClose,