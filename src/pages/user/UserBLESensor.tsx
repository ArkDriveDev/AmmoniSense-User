import React, { useEffect, useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonIcon,
  IonGrid,
  IonToast,
  IonRefresher,
  IonRefresherContent
} from '@ionic/react';
import {
  bluetoothOutline,
  searchOutline,
  cloudUploadOutline
} from 'ionicons/icons';
import { useNavigate } from 'react-router-dom';
import BLEScanner from '../../components/BLEScanner';
import BLEReadingDisplay from '../../components/BLEReadingDisplay';
import bleCentralService, { BLECentralReading, BLECentralDevice } from '../../services/bleCentralService';
import offlineStorage from '../../services/OfflineStorageService';

export default function UserBLESensor() {
  const navigate = useNavigate();
  const [reading, setReading] = useState<BLECentralReading | null>(null);
  const [activeDevice, setActiveDevice] = useState<BLECentralDevice | null>(null);
  const [showScannerModal, setShowScannerModal] = useState<boolean>(false);

  // Toast
  const [toastMsg, setToastMsg] = useState<string>('');
  const [showToast, setShowToast] = useState<boolean>(false);
