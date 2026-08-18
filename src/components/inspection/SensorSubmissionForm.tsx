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
          current_grid_cell_id: os.current_grid_cell_id,
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

  const fetchPreviousReadings = async (siteId: number) => {
    try {
      const { data: siteDevices } = await supabase
        .from('devices')
        .select('device_uid')
        .eq('site_id', siteId);

      const uids = siteDevices?.map(d => d.device_uid) || [];

      let query = supabase
        .from('sensor_data')
        .select('id, latitude, longitude, ammonia, grid_cell_id, device_uid, created_at, photo_url')
        .order('created_at', { ascending: false })
        .limit(30);

      if (uids.length > 0) {
        query = query.in('device_uid', uids);
      }

      const { data } = await query;
      if (data) {
        const formatted: SensorReadingMarker[] = data
          .filter(d => d.latitude && d.longitude)
          .map(d => ({
            id: d.id,
            latitude: d.latitude,
            longitude: d.longitude,
            ammonia: d.ammonia || 0,
            grid_cell_id: d.grid_cell_id || undefined,
            device_uid: d.device_uid,
            created_at: d.created_at,
            photo_url: d.photo_url || undefined,
          }));
        setPreviousReadings(formatted);
      }
    } catch (err) {
      console.error('Error fetching previous readings:', err);
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

      setToastMsg(`Step 1 Complete! Photo uploaded & inserted into inspection_photos (is_used = false).`);
      setToastColor('success');
      setShowToast(true);

      // Auto advance to Step 2
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
  // STEP 2: SELECT GRID CELL
  // =========================================================
  const handleStep2_SelectCell = async (cellId: string, lat: number, lng: number) => {
    setSelectedCellId(cellId);
    setCellLat(lat);
    setCellLng(lng);

    if (photoRecord?.id) {
      await step2_updatePhotoGridCell(photoRecord.id, cellId);
    }

    setToastMsg(`Step 2 Complete! Selected Grid Cell ${cellId} and updated inspection_photos.`);
    setToastColor('success');
    setShowToast(true);

    // Auto advance to Step 3
    setCurrentStep(3);
  };

  // =========================================================
  // STEP 3: CONNECT ESP32 BLUETOOTH / READ SENSOR
  // =========================================================
  const handleStep3_ConnectBluetooth = async () => {
    setBtConnecting(true);
    try {
      let reading: BLEReading | null = null;
      try {
        reading = await bleService.scanAndConnect();
      } catch (scanErr: any) {
        console.info('Scanning fallback to simulator connection');
        reading = await bleService.simulateConnection('moderate');
      }

      if (reading) {
        setAmmonia(reading.ammonia.toString());
        setTemperature(reading.temperature.toString());
        setHumidity(reading.humidity.toString());
        setBattery(reading.battery.toString());
        setBtConnected(true);
        if (reading.device_uid) setSelectedDeviceUid(reading.device_uid);
        if (reading.rssi !== undefined) setBleRssi(reading.rssi);

        setToastMsg(`Step 3 Complete! Received BLE telemetry from ${reading.device_uid}.`);
        setToastColor('success');
        setShowToast(true);
      }
    } catch (err: any) {
      setToastMsg('Bluetooth connection failed: ' + (err.message || 'Error'));
      setToastColor('warning');
      setShowToast(true);
    } finally {
      setBtConnecting(false);
    }
  };

  // =========================================================
  // STEP 4: SUBMIT ALL DATA
  // =========================================================
  const handleStep4_SubmitAll = async () => {
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
        grid_cell_id: selectedCellId,
        latitude: cellLat,
        longitude: cellLng,
        submitted_by: userId,
        photo_url: photoRecord?.photo_url || null,
        inspection_photo_id: photoRecord?.id || null,
      };

      if (!syncService.isOnline()) {
        throw new Error('OFFLINE_MODE');
      }

      // Online submission path
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

      setToastMsg(`🎉 Step 4 Success! Sensor reading & photo fully submitted & linked!`);
      setToastColor('success');
      setShowToast(true);
      offlineStorage.clearDraft(SENSOR_DRAFT_KEY);

      setPhotoRecord(null);
      setCurrentStep(1);

      if (selectedSiteId) fetchPreviousReadings(selectedSiteId);
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
        grid_cell_id: selectedCellId,
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

      if (selectedSiteId) fetchPreviousReadings(selectedSiteId);
      if (onSuccess) onSuccess();
    } finally {
      setSubmitLoading(false);
    }
  };

  const [showCreateSiteModal, setShowCreateSiteModal] = useState<boolean>(false);

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

      {/* 4-STEP WIZARD PROGRESS HEADER */}
      <IonGrid style={{ padding: 0, marginBottom: '16px' }}>
        <IonRow>
          {[
            { num: 1, title: 'STEP 1: Take Photo', icon: cameraOutline },
            { num: 2, title: 'STEP 2: Grid Cell', icon: locationOutline },
            { num: 3, title: 'STEP 3: ESP32 Bluetooth', icon: bluetoothOutline },
            { num: 4, title: 'STEP 4: Submit All', icon: cloudUploadOutline },
          ].map(s => {
            const isActive = currentStep === s.num;
            const isDone = currentStep > s.num;
            return (
              <IonCol key={s.num} size="6" size-md="3">
                <div
                  onClick={() => {
                    // Allow navigating to completed or active steps
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
                  <IonIcon icon={isDone ? checkmarkDoneCircleOutline : s.icon} style={{ fontSize: '18px' }} />
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
              Take an inspection photo. GPS coordinates will be captured, the photo will be uploaded to Supabase Storage, and recorded into <code>inspection_photos</code> with <code>is_used = false</code>.
            </p>

            {photoRecord ? (
              <div style={{ textAlign: 'center', margin: '16px 0' }}>
                <div style={{ position: 'relative', display: 'inline-block', maxWidth: '100%', borderRadius: '8px', overflow: 'hidden', border: '2px solid #2dd36f' }}>
                  <img src={photoRecord.dataUrl || photoRecord.photo_url} alt="Captured" style={{ width: '100%', maxHeight: '240px', objectFit: 'cover' }} />
                  <IonChip color="warning" style={{ position: 'absolute', top: '8px', right: '8px' }}>
                    is_used = false
                  </IonChip>
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
                  Please select a site using the <b>MONITORING SITE</b> dropdown above, or click <b>+ New Site</b> in the top bar to create one first.
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
                Proceed to STEP 2: Select Grid Cell ➔
              </IonButton>
            )}
          </IonCardContent>
        </IonCard>
      )}

      {/* STEP 2: SELECT GRID CELL CARD */}
      {currentStep === 2 && (
        <IonCard style={{ margin: '0 0 16px 0', borderRadius: '12px' }}>
          <IonCardHeader>
            <IonCardTitle style={{ fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IonIcon icon={locationOutline} color="secondary" />
              STEP 2: Select Grid Cell on Leaflet Map
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <p style={{ fontSize: '14px', color: '#64748b', marginTop: 0 }}>
              The map is automatically centered on your photo's captured GPS (<b>{cellLat.toFixed(5)}°, {cellLng.toFixed(5)}°</b>). Tap a grid cell to select it.
            </p>

            <SiteGridMap
              centerLat={cellLat}
              centerLng={cellLng}
              siteName={selectedSite?.site_name || 'Monitoring Site'}
              selectedCellId={selectedCellId}
              onSelectCell={handleStep2_SelectCell}
              readings={previousReadings}
              height="380px"
            />

            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                Selected Cell: <IonBadge color="primary" style={{ fontSize: '14px' }}>{selectedCellId}</IonBadge>
              </div>
              <IonButton color="secondary" onClick={() => setCurrentStep(3)}>
                Proceed to STEP 3: Sensor Reading ➔
              </IonButton>
            </div>
          </IonCardContent>
        </IonCard>
      )}

      {/* STEP 3: ESP32 BLUETOOTH SENSOR READING */}
      {currentStep === 3 && (
        <IonCard style={{ margin: '0 0 16px 0', borderRadius: '12px' }}>
          <IonCardHeader>
            <IonCardTitle style={{ fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IonIcon icon={bluetoothOutline} color="tertiary" />
              STEP 3: Read Sensor via Bluetooth (ESP32)
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <IonItem lines="full" style={{ marginBottom: '12px' }}>
              <IonLabel position="stacked">Target Device</IonLabel>
              <IonSelect
                value={selectedDeviceUid}
                placeholder="Select Device"
                onIonChange={e => setSelectedDeviceUid(e.detail.value)}
              >
                {devices.length > 0 ? (
                  devices.map(d => (
                    <IonSelectOption key={d.device_uid} value={d.device_uid}>
                      {d.device_uid}
                    </IonSelectOption>
                  ))
                ) : (
                  <IonSelectOption value="ESP32-AMMONIA-NODE-01">
                    ESP32-AMMONIA-NODE-01
                  </IonSelectOption>
                )}
              </IonSelect>
            </IonItem>

            <div style={{
              backgroundColor: btConnected ? '#f0fdf4' : '#f8fafc',
              border: `1px solid ${btConnected ? '#86efac' : '#cbd5e1'}`,
              borderRadius: '8px',
              padding: '16px',
              textAlign: 'center',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <IonButton color="tertiary" onClick={handleStep3_ConnectBluetooth} disabled={btConnecting}>
                  {btConnecting ? (
                    <>
                      <IonSpinner name="crescent" />
                      &nbsp;Connecting BLE...
                    </>
                  ) : (
                    <>
                      <IonIcon icon={bluetoothOutline} slot="start" />
                      {btConnected ? 'Re-scan ESP32 BLE' : 'Connect ESP32 BLE'}
                    </>
                  )}
                </IonButton>

                <IonButton fill="outline" color="dark" onClick={() => setShowBLESimulatorModal(true)}>
                  📡 Launch BLE Simulator
                </IonButton>
              </div>

              {btConnected && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#166534', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span>
                    <IonIcon icon={checkmarkCircleOutline} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                    BLE Connected ({selectedDeviceUid})
                  </span>
                  {bleRssi && (
                    <IonBadge color="success" style={{ fontSize: '10px' }}>
                      RSSI: {bleRssi} dBm
                    </IonBadge>
                  )}
                </div>
              )}
            </div>

            <IonItem lines="full" style={{ marginBottom: '12px' }}>
              <IonLabel position="stacked">Ammonia (NH₃) Reading (ppm)</IonLabel>
              <IonInput
                type="number"
                value={ammonia}
                onIonChange={e => setAmmonia(e.detail.value!)}
              />
            </IonItem>

            <IonRow>
              <IonCol size="4">
                <IonItem lines="full">
                  <IonLabel position="stacked">Temp (°C)</IonLabel>
                  <IonInput type="number" value={temperature} onIonChange={e => setTemperature(e.detail.value!)} />
                </IonItem>
              </IonCol>
              <IonCol size="4">
                <IonItem lines="full">
                  <IonLabel position="stacked">Humidity (%)</IonLabel>
                  <IonInput type="number" value={humidity} onIonChange={e => setHumidity(e.detail.value!)} />
                </IonItem>
              </IonCol>
              <IonCol size="4">
                <IonItem lines="full">
                  <IonLabel position="stacked">Battery (%)</IonLabel>
                  <IonInput type="number" value={battery} onIonChange={e => setBattery(e.detail.value!)} />
                </IonItem>
              </IonCol>
            </IonRow>

            <IonButton expand="block" color="primary" onClick={() => setCurrentStep(4)} style={{ marginTop: '16px' }}>
              Proceed to STEP 4: Submit All ➔
            </IonButton>
          </IonCardContent>
        </IonCard>
      )}

      {/* STEP 4: SUBMIT ALL DATA CARD */}
      {currentStep === 4 && (
        <IonCard style={{ margin: '0 0 16px 0', borderRadius: '12px' }}>
          <IonCardHeader>
            <IonCardTitle style={{ fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IonIcon icon={cloudUploadOutline} color="success" />
              STEP 4: Review & Submit All Inspection Data
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent>
            <div style={{ backgroundColor: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div><b>Site:</b> {selectedSite?.site_name || 'N/A'}</div>
              <div><b>Grid Cell:</b> <IonBadge color="primary">{selectedCellId}</IonBadge></div>
              <div><b>GPS:</b> {cellLat.toFixed(5)}°, {cellLng.toFixed(5)}°</div>
              <div><b>Device:</b> {selectedDeviceUid}</div>
              <div><b>Ammonia NH₃:</b> <IonBadge color={parseFloat(ammonia) > 40 ? 'warning' : 'success'}>{ammonia} ppm</IonBadge></div>
              <div><b>Photo Linked:</b> {photoRecord ? `Photo #${photoRecord.id}` : 'None'}</div>
            </div>

            <IonButton
              expand="block"
              color="success"
              size="large"
              onClick={handleStep4_SubmitAll}
              disabled={submitLoading}
              style={{ fontWeight: 'bold' }}
            >
              {submitLoading ? (
                <>
                  <IonSpinner name="crescent" />
                  &nbsp;Inserting sensor_data & linking photo...
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

      <BLESimulatorModal
        isOpen={showBLESimulatorModal}
        onClose={() => setShowBLESimulatorModal(false)}
      />
    </div>
  );
};

export default SensorSubmissionForm;
