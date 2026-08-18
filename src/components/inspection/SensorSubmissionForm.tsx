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
        setSites(allSites);
        setSelectedSiteId(allSites[0].id);
      }
    } catch (err) {
      console.error('Error fetching sites:', err);
    }
  };

  const fetchDevicesForSite = async (siteId: number) => {
    try {
      const { data } = await supabase
        .from('devices')
        .select('id, device_uid')
        .eq('site_id', siteId);

      if (data && data.length > 0) {
        setDevices(data);
        setSelectedDeviceUid(data[0].device_uid);
      } else {
        setDevices([]);
        setSelectedDeviceUid('ESP32-AMMONIA-NODE-01');
      }
    } catch (err) {
      console.error('Error fetching devices:', err);
    }
  };

  // =========================================================
  // STEP 1: TAKE PHOTO
  // =========================================================
  const handleStep1_TakePhoto = async () => {
    if (!selectedSiteId) {
      setToastMsg('Please select or create a monitoring site first before taking an inspection photo.');
      setToastColor('warning');
      setShowToast(true);
      return;
    }
    setStep1Loading(true);
    try {
      const record = await step1_takeAndUploadPhoto(
        selectedSiteId || undefined,
        selectedSite?.site_name || 'MENRO Site'
      );

      setPhotoRecord(record);
      setCellLat(record.latitude);
      setCellLng(record.longitude);

      setToastMsg(`Step 1 Complete! Inspection photo uploaded & GPS captured.`);
      setToastColor('success');
      setShowToast(true);

      setCurrentStep(2);
    } catch (err: any) {
      console.error('Step 1 Error:', err);
      setToastMsg('Step 1 Photo Capture Failed: ' + (err.message || 'Error'));
      setToastColor('danger');
      setShowToast(true);
    } finally {
      setStep1Loading(false);
    }
  };

  // =========================================================
  // STEP 2: CONNECT ESP32 BLUETOOTH / READ SENSOR
  // =========================================================
  const handleStep2_ConnectBluetooth = async () => {
    setBtConnecting(true);
    try {
      const devices = await bleCentralService.scanForDevices();
      if (devices.length > 0) {
        await bleCentralService.connectAndSubscribe(devices[0]);
        setBtConnected(true);
        setSelectedDeviceUid(devices[0].name || devices[0].id);
        setToastMsg(`Step 2 Complete! Connected to BLE Central device ${devices[0].name}.`);
        setToastColor('success');
        setShowToast(true);
      } else {
        setToastMsg('No BLE Central hardware devices found. Ensure device is advertising Service 0000ffd0...');
        setToastColor('warning');
        setShowToast(true);
      }
    } catch (err: any) {
      setToastMsg('BLE Bluetooth connection failed: ' + (err.message || 'Error'));
      setToastColor('warning');
      setShowToast(true);
    } finally {
      setBtConnecting(false);
    }
  };

  // =========================================================
  // STEP 3: SUBMIT ALL DATA
  // =========================================================
  const handleStep3_SubmitAll = async () => {
    if (!ammonia) {
      setToastMsg('Please enter an ammonia reading');
      setToastColor('warning');
      setShowToast(true);
      return;
    }

    setSubmitLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id || null;

      const ammoniaNum = parseFloat(ammonia);
      const tempNum = parseFloat(temperature);
      const humNum = parseFloat(humidity);
      const battNum = parseFloat(battery);

      let status = 'LOW';
      if (ammoniaNum > 70) status = 'HIGH';
      else if (ammoniaNum > 40) status = 'MODERATE';

      const sensorPayload: any = {
        device_uid: selectedDeviceUid || 'ESP32-AMMONIA-NODE-01',
        ammonia: ammoniaNum,
        temperature: isNaN(tempNum) ? null : tempNum,
        humidity: isNaN(humNum) ? null : humNum,
        battery: isNaN(battNum) ? 100 : battNum,
        status,
        latitude: cellLat,
        longitude: cellLng,
        submitted_by: userId,
        photo_url: photoRecord?.photo_url || null,
        inspection_photo_id: photoRecord?.id || null,
      };

      if (!syncService.isOnline()) {
        throw new Error('OFFLINE_MODE');
      }

      const { data: insertedSensorData, error: sensorError } = await supabase
        .from('sensor_data')
        .insert([sensorPayload])
        .select('id')
        .single();

      if (sensorError) {
        throw new Error('Supabase insert sensor_data error: ' + sensorError.message);
      }

      const sensorDataId = insertedSensorData?.id;

      if (photoRecord?.id && sensorDataId) {
        await step4_markPhotoAsUsed(photoRecord.id, sensorDataId);
      }

      setToastMsg(`🎉 Inspection Success! Sensor reading & photo fully submitted & linked!`);
      setToastColor('success');
      setShowToast(true);
      offlineStorage.clearDraft(SENSOR_DRAFT_KEY);

      setPhotoRecord(null);
      setCurrentStep(1);

      if (onSuccess) onSuccess();
    } catch (err: any) {
      console.warn('Network error or offline mode during inspection submit, queueing item:', err);

      let photoStoreId: string | undefined = undefined;
      if (photoRecord?.dataUrl) {
        photoStoreId = await offlineStorage.savePhoto(photoRecord.dataUrl);
      }

      await offlineStorage.enqueueItem('SENSOR_READING', {
        device_uid: selectedDeviceUid || 'ESP32-AMMONIA-NODE-01',
        ammonia: parseFloat(ammonia) || 0,
        temperature: parseFloat(temperature) || 0,
        humidity: parseFloat(humidity) || 0,
        battery: parseFloat(battery) || 100,
        status: parseFloat(ammonia) > 70 ? 'HIGH' : parseFloat(ammonia) > 40 ? 'MODERATE' : 'LOW',
        latitude: cellLat,
        longitude: cellLng,
        photo_url: photoRecord?.photo_url || null,
      }, photoStoreId);

      offlineStorage.clearDraft(SENSOR_DRAFT_KEY);

      setToastMsg(`📶 Offline Mode: Reading saved locally and queued for auto-sync when online!`);
      setToastColor('warning');
      setShowToast(true);

      setPhotoRecord(null);
      setCurrentStep(1);

      if (onSuccess) onSuccess();
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto' }}>
      {/* Site Selection Top Bar */}
      <IonCard style={{ margin: '0 0 16px 0', borderRadius: '12px' }}>
        <IonCardContent style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <IonItem lines="none" style={{ flex: 1, padding: 0 }}>
              <IonLabel position="stacked" style={{ fontWeight: 'bold', fontSize: '13px', color: '#475569' }}>
                MONITORING SITE
              </IonLabel>
              <IonSelect
                value={selectedSiteId}
                placeholder="Select Site"
                onIonChange={e => setSelectedSiteId(e.detail.value)}
              >
                {sites.map(site => (
                  <IonSelectOption key={site.id} value={site.id}>
                    {site.site_name} ({site.site_code})
                  </IonSelectOption>
                ))}
              </IonSelect>
            </IonItem>

            <IonButton
              fill="outline"
              size="small"
              color="primary"
              onClick={() => setShowCreateSiteModal(true)}
              style={{ marginLeft: '12px', marginTop: '12px' }}
            >
              <IonIcon icon={addOutline} slot="start" />
              + New Site
            </IonButton>
          </div>
        </IonCardContent>
      </IonCard>

      {/* 3-STEP WIZARD PROGRESS HEADER (No Grid Cells) */}
      <IonGrid style={{ padding: 0, marginBottom: '16px' }}>
        <IonRow>
          {[
            { num: 1, title: 'STEP 1: GPS Photo', icon: cameraOutline },
            { num: 2, title: 'STEP 2: BLE Sensor', icon: bluetoothOutline },
            { num: 3, title: 'STEP 3: Submit All', icon: cloudUploadOutline },
          ].map(s => {
            const isActive = currentStep === s.num;
            const isDone = currentStep > s.num;
            return (
              <IonCol key={s.num} size="4">
                <div
                  onClick={() => {