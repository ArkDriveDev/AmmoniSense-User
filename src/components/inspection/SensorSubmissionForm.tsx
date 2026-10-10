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
  shapesOutline,
  alertCircleOutline,
  refreshOutline
} from 'ionicons/icons';
import { supabase } from '../../services/supabase';
import CreateSiteModal from '../sites/CreateSiteModal';
import offlineStorage, { SENSOR_DRAFT_KEY } from '../../services/OfflineStorageService';
import syncService from '../../services/SyncService';

import {
  InspectionPhotoRecord,
  step1_takeAndUploadPhoto,
} from '../../utils/photoUtils';
import bleService, { BLEReading } from '../../services/bleService';
import bleCentralService, { BLECentralReading } from '../../services/bleCentralService';
import bluetoothClassicService, { ensureBluetoothPermissions } from '../../services/bluetoothClassicService';
import { AmmoniSenseReading, BluetoothConnectionStatus } from '../../types/schema';
import { usePpmConfirmation } from '../../hooks/usePpmConfirmation';
import { autoRegisterDevice } from '../../services/deviceService';

interface MonitoringSite {
  id: number;
  site_code: string;
  site_name: string;
  location?: string | null;
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
  const [selectedSiteId, setSelectedSiteId] = useState<number | string | null>(null);
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
  const [ammonia, setAmmonia] = useState<string>('');
  const [temperature, setTemperature] = useState<string>('');
  const [humidity, setHumidity] = useState<string>('');
  const [battery, setBattery] = useState<string>('');
  const [btConnecting, setBtConnecting] = useState<boolean>(false);
  const [btConnected, setBtConnected] = useState<boolean>(false);
  const [btStatus, setBtStatus] = useState<BluetoothConnectionStatus>(bluetoothClassicService.getStatus());
  const [btStatusMsg, setBtStatusMsg] = useState<string>(bluetoothClassicService.getStatusMessage());
  const [bleRssi, setBleRssi] = useState<number | null>(null);
  const [showBLESimulatorModal, setShowBLESimulatorModal] = useState<boolean>(false);

  // 10-Second confirmation rule hook for non-zero PPM
  const { status: ppmConfirmationStatus, badgeLabel: ppmBadgeLabel, badgeColor: ppmBadgeColor } = usePpmConfirmation(
    ammonia !== '' && !isNaN(parseFloat(ammonia)) ? parseFloat(ammonia) : null,
    btConnected
  );

  // STEP 3 State: Submission Loading
  const [submitLoading, setSubmitLoading] = useState<boolean>(false);

  // Toast State
  const [toastMsg, setToastMsg] = useState<string>('');
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastColor, setToastColor] = useState<string>('success');

  const [showCreateSiteModal, setShowCreateSiteModal] = useState<boolean>(false);

  useEffect(() => {
    fetchSites();
    // Subscribe to Classic Bluetooth SPP Status
    const unsubClassicStatus = bluetoothClassicService.onStatusChange((st, msg) => {
      setBtStatus(st);
      if (msg) setBtStatusMsg(msg);
      setBtConnecting(st === 'connecting');
      setBtConnected(st === 'connected');
    });

    // Subscribe to Classic Bluetooth SPP Readings
    const unsubClassicReading = bluetoothClassicService.onReading((reading: AmmoniSenseReading) => {
      if (reading.nh3_ppm !== null && reading.nh3_ppm !== undefined) {
        setAmmonia(reading.nh3_ppm.toFixed(2));
      }
      if (reading.temperature !== null && reading.temperature !== undefined) {
        setTemperature(reading.temperature.toFixed(1));
      }
      if (reading.humidity !== null && reading.humidity !== undefined) {
        setHumidity(reading.humidity.toFixed(1));
      }
      if (reading.battery_percent !== null && reading.battery_percent !== undefined) {
        setBattery(reading.battery_percent.toString());
      }
      setSelectedDeviceUid('AmmoniSense');
      setBtConnected(true);
      setToastMsg(`📡 AmmoniSense SPP Reading: NH₃ ${reading.nh3_ppm !== null ? reading.nh3_ppm.toFixed(2) : '—'} ppm`);
      setToastColor('success');
      setShowToast(true);
    });

    // Check for draft BLE Central reading from UserBLESensor page
    const draftBLE = offlineStorage.getDraft<BLECentralReading>('draft_ble_central_reading');
    if (draftBLE) {
      if (draftBLE.ammonia_ppm !== undefined) setAmmonia(draftBLE.ammonia_ppm.toString());
      if (draftBLE.temperature_c !== undefined) setTemperature(draftBLE.temperature_c.toString());
      if (draftBLE.humidity_pct !== undefined) setHumidity(draftBLE.humidity_pct.toString());
      if (draftBLE.battery_pct !== undefined) setBattery(draftBLE.battery_pct.toString());
      if (draftBLE.device_name || draftBLE.device_id) {
        setSelectedDeviceUid(draftBLE.device_name || draftBLE.device_id);
      }
      setBtConnected(true);
      offlineStorage.clearDraft('draft_ble_central_reading');
    }

    // Subscribe to BLE Central 12-byte Float32 telemetry fallback
    const unsubCentral = bleCentralService.onTelemetry((telemetry: BLECentralReading) => {
      if (telemetry.ammonia_ppm !== undefined) setAmmonia(telemetry.ammonia_ppm.toString());
      if (telemetry.temperature_c !== undefined) setTemperature(telemetry.temperature_c.toString());
      if (telemetry.humidity_pct !== undefined) setHumidity(telemetry.humidity_pct.toString());
      if (telemetry.battery_pct !== undefined) setBattery(telemetry.battery_pct.toString());
      if (telemetry.device_name || telemetry.device_id) {
        setSelectedDeviceUid(telemetry.device_name || telemetry.device_id);
      }
      if (telemetry.rssi) setBleRssi(telemetry.rssi);
      setBtConnected(true);
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
    });

    return () => {
      unsubClassicStatus();
      unsubClassicReading();
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
      fetchDevices();
    }
  }, [selectedSiteId]);

  const fetchSites = async () => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;

      let onlineSites: any[] = [];
      const { data, error } = await supabase.from('inspection_sites').select('*').eq('created_by', userId);
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

  const fetchDevices = async () => {
    try {
      const { data } = await supabase
        .from('devices')
        .select('id, device_uid');

      if (data && data.length > 0) {
        setDevices(data);
        if (!selectedDeviceUid || selectedDeviceUid === 'ESP32-AMMONIA-NODE-01') {
          setSelectedDeviceUid(data[0].device_uid);
        }
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
    if (btConnecting) return; // Ignore duplicate taps while connecting
    setBtConnecting(true);
    try {
      const perm = await ensureBluetoothPermissions();
      if (!perm.granted) {
        setBtConnecting(false);
        setToastMsg('Bluetooth permission denied. Please allow Nearby devices permission in Settings.');
        setToastColor('warning');
        setShowToast(true);
        return;
      }

      const reading = await bluetoothClassicService.connect().catch((err) => {
        console.error('SPP connect failed (promise):', err);
        return null;
      });
      if (reading) {
        setBtConnected(true);
        setSelectedDeviceUid('AmmoniSense');
        setToastMsg('Step 2 Complete! Connected to AmmoniSense sensor.');
        setToastColor('success');
        setShowToast(true);
      }
    } catch (err: any) {
      console.error('SPP connect failed:', err);
      setToastMsg('Bluetooth connection failed: ' + (err.message || 'Device not ready'));
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
    if (ammonia === '' || ammonia === null || ammonia === undefined || isNaN(parseFloat(ammonia))) {
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

      const targetDevice = selectedDeviceUid || 'ESP32-AMMONIA-NODE-01';

      // Ensure device is registered in Supabase devices table
      try {
        await autoRegisterDevice(targetDevice);
      } catch (devErr) {
        console.warn('Notice registering device:', devErr);
      }

      const numericSiteId = (
        selectedSiteId &&
        typeof selectedSiteId !== 'string' ||
        (typeof selectedSiteId === 'string' && !selectedSiteId.startsWith('temp_') && !isNaN(Number(selectedSiteId)))
      ) ? Number(selectedSiteId) : null;

      const sensorPayload: any = {
        device_uid: targetDevice,
        ammonia: ammoniaNum,
        temperature: isNaN(tempNum) ? null : tempNum,
        humidity: isNaN(humNum) ? null : humNum,
        battery: isNaN(battNum) ? null : battNum,
        status,
        latitude: cellLat,
        longitude: cellLng,
        submitted_by: userId,
        photo_url: photoRecord?.photo_url || null,
        inspection_site_id: numericSiteId,
      };

      if (!syncService.isOnline()) {
        throw new Error('OFFLINE_MODE');
      }

      let insertedSensorData: any = null;
      let { data: firstInsert, error: sensorError } = await supabase
        .from('sensor_data')
        .insert([sensorPayload])
        .select('id')
        .maybeSingle();

      // Retry without inspection_site_id if column not yet in schema cache (migration pending)
      if (sensorError && (
        sensorError.message?.includes('inspection_site_id') ||
        sensorError.code === '42703' ||
        sensorError.code === 'PGRST204'
      )) {
        const { inspection_site_id: _dropped, ...minimalPayload } = sensorPayload;
        const { data: fallbackInsert, error: fallbackErr } = await supabase
          .from('sensor_data')
          .insert([minimalPayload])
          .select('id')
          .maybeSingle();

        if (!fallbackErr && fallbackInsert) {
          firstInsert = fallbackInsert;
          sensorError = null;
        } else if (fallbackErr) {
          sensorError = fallbackErr;
        }
      }

      if (sensorError || !firstInsert) {
        throw new Error('Supabase insert sensor_data error: ' + (sensorError?.message || 'Insert failed'));
      }

      insertedSensorData = firstInsert;

      setToastMsg(`🎉 Inspection Success! Reading submitted!`);
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


      await offlineStorage.enqueueItem('sensor_data', {
        device_uid: selectedDeviceUid || 'ESP32-AMMONIA-NODE-01',
        ammonia: parseFloat(ammonia) || 0,
        temperature: !isNaN(parseFloat(temperature)) ? parseFloat(temperature) : null,
        humidity: !isNaN(parseFloat(humidity)) ? parseFloat(humidity) : null,
        battery: !isNaN(parseFloat(battery)) ? parseFloat(battery) : null,
        status: parseFloat(ammonia) > 70 ? 'HIGH' : parseFloat(ammonia) > 40 ? 'MODERATE' : 'LOW',
        latitude: cellLat,
        longitude: cellLng,
        photo_url: photoRecord?.photo_url || null,
      }, {
        action: 'insert',
        photoStoreId,
      });

      offlineStorage.clearDraft(SENSOR_DRAFT_KEY);

      setToastMsg(`📶 Offline Mode: Reading saved locally and queued for auto-sync!`);
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
                    if (s.num <= currentStep || (s.num === 2 && photoRecord)) {
                      setCurrentStep(s.num as any);
                    }
                  }}
                  style={{
                    backgroundColor: isActive ? '#3880ff' : isDone ? '#2dd36f' : '#f1f5f9',
                    color: isActive || isDone ? '#ffffff' : '#64748b',
                    padding: '10px 8px',
                    borderRadius: '8px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: 600,
                    boxShadow: isActive ? '0 3px 8px rgba(56, 128, 255, 0.3)' : 'none',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <IonIcon icon={isDone ? checkmarkCircleOutline : s.icon} style={{ fontSize: '18px' }} />
                  <span>{s.title}</span>
                </div>
              </IonCol>
            );
          })}
        </IonRow>
      </IonGrid>

      {/* STEP 1: TAKE PHOTO CARD */}
      {currentStep === 1 && (
        <IonCard style={{ margin: '0 0 16px 0', borderRadius: '12px' }}>
          <IonCardHeader>
            <IonCardTitle style={{ fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IonIcon icon={cameraOutline} color="primary" />
              STEP 1: Capture Photo & GPS
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <p style={{ fontSize: '14px', color: '#64748b', marginTop: 0 }}>
              Take an inspection photo. GPS coordinates will be captured and linked to your inspection.
            </p>

            {photoRecord ? (
              <div style={{ textAlign: 'center', margin: '16px 0' }}>
                <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', borderRadius: '8px', overflow: 'hidden', border: '2px solid #2dd36f' }}>
                  <img src={photoRecord.dataUrl || photoRecord.photo_url} alt="Captured" style={{ width: '100%', maxHeight: '240px', objectFit: 'cover' }} />
                </div>
                <div style={{ fontSize: '12px', color: '#475569', marginTop: '8px' }}>
                  <b>GPS:</b> {photoRecord.latitude.toFixed(5)}°, {photoRecord.longitude.toFixed(5)}° | <b>Photo ID:</b> #{photoRecord.id}
                </div>
                <IonButton fill="clear" color="medium" size="small" onClick={handleStep1_TakePhoto} style={{ marginTop: '4px' }}>
                  Retake Photo
                </IonButton>
              </div>
            ) : !selectedSiteId ? (
              <div style={{
                padding: '24px',
                border: '2px dashed #fcd34d',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#fffbeb',
                margin: '16px 0',
                textAlign: 'center'
              }}>
                <IonIcon icon={cameraOutline} style={{ fontSize: '48px', color: '#d97706', marginBottom: '8px' }} />
                <h4 style={{ margin: '0 0 6px 0', color: '#92400e', fontWeight: 'bold' }}>
                  No Monitoring Site Selected
                </h4>
                <p style={{ margin: 0, color: '#b45309', fontSize: '13px', maxWidth: '400px', lineHeight: '1.4' }}>
                  Please select a site using the <b>MONITORING SITE</b> dropdown above.
                </p>
              </div>
            ) : (
              <div style={{
                height: '180px',
                border: '2px dashed #cbd5e1',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#f8fafc',
                margin: '16px 0'
              }}>
                <IonIcon icon={cameraOutline} style={{ fontSize: '48px', color: '#94a3b8', marginBottom: '8px' }} />
                <IonButton color="primary" onClick={handleStep1_TakePhoto} disabled={step1Loading}>
                  {step1Loading ? (
                    <>
                      <IonSpinner name="crescent" />
                      &nbsp;Capturing & Uploading...
                    </>
                  ) : (
                    '📷 Take Inspection Photo'
                  )}
                </IonButton>
              </div>
            )}

            {photoRecord && (
              <IonButton expand="block" color="primary" onClick={() => setCurrentStep(2)} style={{ marginTop: '16px' }}>
                Proceed to STEP 2: BLE Sensor ➔
              </IonButton>
            )}
          </IonCardContent>
        </IonCard>
      )}

      {/* STEP 2: ESP32 BLUETOOTH SENSOR READING */}
      {currentStep === 2 && (
        <IonCard style={{ margin: '0 0 16px 0', borderRadius: '12px' }}>
          <IonCardHeader>
            <IonCardTitle style={{ fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IonIcon icon={bluetoothOutline} color="tertiary" />
              STEP 2: Read Sensor via Bluetooth (AmmoniSense)
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            {/* Honest Bluetooth Status Message Banner */}
            {btStatus !== 'connected' && btStatusMsg && (
              <div style={{
                padding: '12px 16px',
                borderRadius: '8px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                backgroundColor: btStatus === 'bluetooth_off' ? '#FEF2F2' : '#FFFBEB',
                color: btStatus === 'bluetooth_off' ? '#991B1B' : '#92400E',
                border: `1px solid ${btStatus === 'bluetooth_off' ? '#FCA5A5' : '#FCD34D'}`
              }}>
                <IonIcon icon={alertCircleOutline} style={{ fontSize: '20px', flexShrink: 0 }} />
                <span>{btStatusMsg}</span>
              </div>
            )}

            <div style={{
              backgroundColor: btConnected ? '#f0fdf4' : '#f8fafc',
              border: `1px solid ${btConnected ? '#86efac' : '#cbd5e1'}`,
              borderRadius: '8px',
              padding: '16px',
              textAlign: 'center',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <IonButton
                  color={btStatus === 'failed' || btStatus === 'device_not_found' || btStatus === 'bluetooth_off' ? 'warning' : 'tertiary'}
                  onClick={handleStep2_ConnectBluetooth}
                  disabled={btConnecting}
                >
                  {btConnecting ? (
                    <>
                      <IonSpinner name="dots" />
                      &nbsp;Connecting…
                    </>
                  ) : btConnected ? (
                    <>
                      <IonIcon icon={refreshOutline} slot="start" />
                      Re-connect AmmoniSense
                    </>
                  ) : btStatus === 'failed' || btStatus === 'device_not_found' || btStatus === 'bluetooth_off' ? (
                    <>
                      <IonIcon icon={refreshOutline} slot="start" />
                      Retry Connection
                    </>
                  ) : (
                    <>
                      <IonIcon icon={bluetoothOutline} slot="start" />
                      Connect AmmoniSense
                    </>
                  )}
                </IonButton>
              </div>

              {btConnected && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#166534', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span>
                    <IonIcon icon={checkmarkCircleOutline} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                    Connected to AmmoniSense (Classic SPP)
                  </span>
                </div>
              )}
            </div>

            <div style={{ marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', padding: '0 4px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#334155' }}>Ammonia (NH₃) Reading (ppm)</span>
                {ppmBadgeLabel && (
                  <IonBadge color={ppmBadgeColor} style={{ fontSize: '10px', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {ppmConfirmationStatus === 'confirming' ? (
                      <IonSpinner name="dots" style={{ width: '12px', height: '12px' }} />
                    ) : (
                      <IonIcon icon={checkmarkCircleOutline} />
                    )}
                    {ppmBadgeLabel}
                  </IonBadge>
                )}
              </div>
              <IonItem lines="full" style={{ borderRadius: '8px' }}>
                <IonInput
                  type="number"
                  placeholder="— (waiting for AmmoniSense…)"
                  value={ammonia}
                  onIonChange={e => setAmmonia(e.detail.value || '')}
                />
              </IonItem>
            </div>

            <IonGrid style={{ padding: 0 }}>
              <IonRow>
                <IonCol size="4">
                  <IonItem lines="full" style={{ borderRadius: '8px' }}>
                    <IonInput
                      label="Temp (°C)"
                      labelPlacement="stacked"
                      type="number"
                      placeholder="— °C"
                      value={temperature}
                      onIonChange={e => setTemperature(e.detail.value || '')}
                    />
                  </IonItem>
                </IonCol>
                <IonCol size="4">
                  <IonItem lines="full" style={{ borderRadius: '8px' }}>
                    <IonInput
                      label="Humidity (%)"
                      labelPlacement="stacked"
                      type="number"
                      placeholder="— %"
                      value={humidity}
                      onIonChange={e => setHumidity(e.detail.value || '')}
                    />
                  </IonItem>
                </IonCol>
                <IonCol size="4">
                  <IonItem lines="full" style={{ borderRadius: '8px' }}>
                    <IonInput
                      label="Battery (%)"
                      labelPlacement="stacked"
                      type="number"
                      placeholder="— %"
                      value={battery}
                      onIonChange={e => setBattery(e.detail.value || '')}
                    />
                  </IonItem>
                </IonCol>
              </IonRow>
            </IonGrid>

            <IonButton expand="block" color="primary" onClick={() => setCurrentStep(3)} style={{ marginTop: '16px' }}>
              Proceed to STEP 3: Submit All ➔
            </IonButton>
          </IonCardContent>
        </IonCard>
      )}

      {/* STEP 3: SUBMIT ALL DATA CARD */}
      {currentStep === 3 && (
        <IonCard style={{ margin: '0 0 16px 0', borderRadius: '12px' }}>
          <IonCardHeader>
            <IonCardTitle style={{ fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IonIcon icon={cloudUploadOutline} color="success" />
              STEP 3: Review & Submit All Inspection Data
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div><b>Site:</b> {selectedSite?.site_name || 'N/A'}</div>
              <div><b>Device:</b> {selectedDeviceUid}</div>
              <div><b>GPS:</b> {cellLat.toFixed(5)}°, {cellLng.toFixed(5)}°</div>
              <div><b>Ammonia NH₃:</b> {ammonia ? <IonBadge color={parseFloat(ammonia) > 40 ? 'warning' : 'success'}>{ammonia} ppm</IonBadge> : <span style={{ color: '#94a3b8' }}>None</span>}</div>
              <div><b>Photo Linked:</b> {photoRecord ? `Photo #${photoRecord.id}` : 'None'}</div>
            </div>

            <IonButton
              expand="block"
              color="success"
              size="large"
              onClick={handleStep3_SubmitAll}
              disabled={submitLoading}
              style={{ fontWeight: 'bold' }}
            >
              {submitLoading ? (
                <>
                  <IonSpinner name="crescent" />
                  &nbsp;Submitting Inspection Data...
                </>
              ) : (
                <>
                  <IonIcon icon={checkmarkDoneCircleOutline} slot="start" />
                  CONFIRM & SUBMIT ALL DATA
                </>
              )}
            </IonButton>
          </IonCardContent>
        </IonCard>
      )}

      <IonToast
        isOpen={showToast}
        onDidDismiss={() => setShowToast(false)}
        message={toastMsg}
        duration={4500}
        color={toastColor}
        position="bottom"
      />

      <CreateSiteModal
        isOpen={showCreateSiteModal}
        onClose={() => setShowCreateSiteModal(false)}
        onSiteCreated={(newSite) => {
          fetchSites();
          if (newSite?.id) {
            setSelectedSiteId(newSite.id);
          }
        }}
      />
    </div>
  );
};

export default SensorSubmissionForm;
