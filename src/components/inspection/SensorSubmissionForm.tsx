import React, { useEffect, useState } from 'react';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonItem,
  IonLabel,
  IonSelect,
  IonSelectOption,
  IonInput,
  IonButton,
  IonIcon,
  IonToast,
  IonSpinner,
  IonChip,
  IonGrid,
  IonRow,
  IonCol,
  IonBadge
} from '@ionic/react';
import {
  cameraOutline,
  bluetoothOutline,
  checkmarkCircleOutline,
  cloudUploadOutline,
  checkmarkDoneCircleOutline,
  addOutline,
  shapesOutline
} from 'ionicons/icons';
import { supabase } from '../../services/supabase';
import CreateSiteModal from '../sites/CreateSiteModal';
import offlineStorage, { SENSOR_DRAFT_KEY } from '../../services/OfflineStorageService';
import syncService from '../../services/SyncService';
import {
  InspectionPhotoRecord,
  step1_takeAndUploadPhoto,
  step4_markPhotoAsUsed
} from '../../utils/photoUtils';
import bleService, { BLEReading } from '../../services/bleService';
import bleCentralService, { BLECentralReading } from '../../services/bleCentralService';

interface MonitoringSite {
  id: number;
  site_code: string;
  site_name: string;
  location?: string | null;
  owner_id: number;
  created_at?: string;
  created_by?: string | null;
  current_latitude?: number | null;
  current_longitude?: number | null;
  address?: string | null;
  area_size_hectares?: number | null;
  site_type?: string | null;
  latitude?: number;
  longitude?: number;
}

interface SensorSubmissionFormProps {
  onSuccess?: () => void;
}

export const SensorSubmissionForm: React.FC<SensorSubmissionFormProps> = ({ onSuccess }) => {
  // Site & Device state
  const [sites, setSites] = useState<MonitoringSite[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [selectedSite, setSelectedSite] = useState<MonitoringSite | null>(null);
  const [devices, setDevices] = useState<{ id: number; device_uid: string }[]>([]);
  const [selectedDeviceUid, setSelectedDeviceUid] = useState<string>('');

  // 3-Step State (No Grid Cells)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // STEP 1 State: Photo & GPS
  const [photoRecord, setPhotoRecord] = useState<InspectionPhotoRecord | null>(null);
  const [step1Loading, setStep1Loading] = useState<boolean>(false);
  const [cellLat, setCellLat] = useState<number>(8.3683);
  const [cellLng, setCellLng] = useState<number>(124.8637);

  // STEP 2 State: Sensor Bluetooth Readings
  const [ammonia, setAmmonia] = useState<string>('24.5');
  const [temperature, setTemperature] = useState<string>('28.5');
  const [humidity, setHumidity] = useState<string>('68.0');
  const [battery, setBattery] = useState<string>('92.0');
  const [btConnecting, setBtConnecting] = useState<boolean>(false);
  const [btConnected, setBtConnected] = useState<boolean>(false);
  const [bleRssi, setBleRssi] = useState<number | null>(null);
  const [showBLESimulatorModal, setShowBLESimulatorModal] = useState<boolean>(false);

  // STEP 3 State: Submission Loading
  const [submitLoading, setSubmitLoading] = useState<boolean>(false);

  // Toast State
  const [toastMsg, setToastMsg] = useState<string>('');
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastColor, setToastColor] = useState<string>('success');

  const [showCreateSiteModal, setShowCreateSiteModal] = useState<boolean>(false);

  useEffect(() => {
    fetchSites();

    // Check for draft BLE Central reading from UserBLESensor page
    const draftBLE = offlineStorage.getDraft<BLECentralReading>('draft_ble_central_reading');
    if (draftBLE) {
      setAmmonia(draftBLE.ammonia_ppm.toString());
      setTemperature(draftBLE.temperature_c.toString());
      setHumidity(draftBLE.humidity_pct.toString());
      if (draftBLE.device_name || draftBLE.device_id) {
        setSelectedDeviceUid(draftBLE.device_name || draftBLE.device_id);
      }
      setBtConnected(true);
      offlineStorage.clearDraft('draft_ble_central_reading');
    }

    // Subscribe to BLE Central 12-byte Float32 telemetry
    const unsubCentral = bleCentralService.onTelemetry((telemetry: BLECentralReading) => {
      setAmmonia(telemetry.ammonia_ppm.toString());
      setTemperature(telemetry.temperature_c.toString());
      setHumidity(telemetry.humidity_pct.toString());
      if (telemetry.device_name || telemetry.device_id) {
        setSelectedDeviceUid(telemetry.device_name || telemetry.device_id);
      }
      if (telemetry.rssi) setBleRssi(telemetry.rssi);
      setBtConnected(true);

      setToastMsg(`📡 BLE Central GATT Notification: NH₃ ${telemetry.ammonia_ppm} PPM`);
      setToastColor('success');
      setShowToast(true);
    });

    // Subscribe to real-time BLE telemetry fallback
    const unsubscribe = bleService.onReading((reading: BLEReading) => {
      setAmmonia(reading.ammonia.toString());
      setTemperature(reading.temperature.toString());
      setHumidity(reading.humidity.toString());
      setBattery(reading.battery.toString());
      setBtConnected(true);
      if (reading.device_uid) {
        setSelectedDeviceUid(reading.device_uid);
      }
      if (reading.rssi !== undefined) {
        setBleRssi(reading.rssi);
      }

      setToastMsg(`📡 BLE Telemetry Auto-Populated from ${reading.device_uid} (${reading.ammonia} ppm NH₃)`);
      setToastColor('success');
      setShowToast(true);
    });

    return () => {
      unsubCentral();
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (selectedSiteId) {
      const site = sites.find(s => s.id === selectedSiteId) || null;
      setSelectedSite(site);
      const siteLat = site?.current_latitude ?? site?.latitude;
      const siteLng = site?.current_longitude ?? site?.longitude;
      if (siteLat && siteLng && !photoRecord) {
        setCellLat(siteLat);
        setCellLng(siteLng);
      }
      fetchDevicesForSite(selectedSiteId);
    }
  }, [selectedSiteId]);

  const fetchSites = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;

      const { data: owners } = await supabase
        .from('site_owners')
        .select('id')
        .eq('created_by', userId);

      const ownerId = owners && owners.length > 0 ? owners[0].id : null;

      let query = supabase.from('monitoring_sites').select('*');
      if (ownerId) {
        query = query.eq('owner_id', ownerId);
      }

      let onlineSites: any[] = [];
      const { data, error } = await query;
      if (!error && data) {
        onlineSites = data;
      }

      let offlineSitesList: any[] = [];
      try {
        const offlineRecords = await offlineStorage.getOfflineSites();
        offlineSitesList = offlineRecords.map(os => ({
          id: os.id,
          site_name: `${os.site_name} (🔴 Offline)`,
          address: os.address,
          current_latitude: os.current_latitude,
          current_longitude: os.current_longitude,
          isOffline: true,
        }));
      } catch (e) {}

      const allSites = [...offlineSitesList, ...onlineSites];
      if (allSites.length > 0) {