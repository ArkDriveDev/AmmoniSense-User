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
  IonGrid,
  IonRow,
  IonCol,
  IonBadge,
  IonButton,
  IonIcon,
  IonModal,
  IonSpinner
} from '@ionic/react';
import { eyeOutline, locationOutline, calendarOutline, hardwareChipOutline, imageOutline, mapOutline } from 'ionicons/icons';
import { supabase } from '../../services/supabase';
import FullMapView, { ReadingMarkerData } from '../map/FullMapView';
import offlineStorage from '../../services/OfflineStorageService';
import PendingSyncBadge from '../common/PendingSyncBadge';

export interface SensorRecord {
  id: number | string;
  device_uid: string;
  ammonia: number;
  temperature?: number;
  humidity?: number;
  battery?: number;
  status: string;
  latitude?: number;
  longitude?: number;
  created_at: string;
  photo_url?: string;
  submitted_by?: string;
  is_pending_sync?: boolean;
}

export const AdminSensorDataViewer: React.FC = () => {
  const [sites, setSites] = useState<{ id: number; site_name: string; current_latitude?: number | null; current_longitude?: number | null; latitude?: number; longitude?: number }[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<number | 'all'>('all');

  const [records, setRecords] = useState<SensorRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const [selectedPhotoRecord, setSelectedPhotoRecord] = useState<SensorRecord | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState<boolean>(false);

  useEffect(() => {
    fetchSites();
    fetchSensorData();
  }, []);

  useEffect(() => {
    fetchSensorData();
  }, [selectedSiteId]);

  const fetchSites = async () => {
    try {
      const { data } = await supabase.from('monitoring_sites').select('*');
      if (data) setSites(data);
    } catch (err) {
      console.error('Error fetching sites:', err);
    }
  };

  const fetchSensorData = async () => {
    setLoading(true);
    let serverRecords: SensorRecord[] = [];
    try {
      const query = supabase
        .from('sensor_data')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      const { data, error } = await query;
      if (!error && data) {
        serverRecords = data;
      }
    } catch (err) {
      console.warn('Error or offline during fetchSensorData:', err);
    }

    try {
      const queue = await offlineStorage.getQueue();
      const pendingReadings = queue
        .filter(q => q.type === 'SENSOR_READING')
        .map(q => ({
          id: q.id,
          device_uid: q.payload.device_uid || 'ESP32-AMMONIA-NODE-01',
          ammonia: q.payload.ammonia || 0,
          temperature: q.payload.temperature,
          humidity: q.payload.humidity,
          battery: q.payload.battery,
          status: q.payload.status || 'LOW',
          latitude: q.payload.latitude,
          longitude: q.payload.longitude,
          created_at: q.timestamp,
          photo_url: q.payload.photo_url,
          is_pending_sync: true,
        }));

      setRecords([...pendingReadings, ...serverRecords]);
    } catch (e) {
      console.error('Error fetching offline queue:', e);
      setRecords(serverRecords);
    } finally {
      setLoading(false);
    }
  };

  const mapMarkers: ReadingMarkerData[] = records
    .filter(r => r.latitude && r.longitude)
    .map(r => ({
      id: r.id,
      latitude: r.latitude!,
      longitude: r.longitude!,
      ammonia: r.ammonia || 0,
      device_uid: r.device_uid,
      created_at: r.created_at,
      photo_url: r.photo_url || undefined,
    }));

  const activeSiteObj = sites.find(s => s.id === selectedSiteId);

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '16px' }}>
      {/* Filters Card */}
      <IonCard style={{ margin: '0 0 20px 0', borderRadius: '12px' }}>
        <IonCardHeader>
          <IonCardTitle style={{ fontSize: '20px', fontWeight: 'bold' }}>
            MENRO Environmental Inspection Dashboard
          </IonCardTitle>
        </IonCardHeader>
        <IonCardContent>
          <IonGrid style={{ padding: 0 }}>
            <IonRow>
              <IonCol size="12">
                <IonItem lines="full">
                  <IonLabel position="stacked">Filter by Monitoring Site</IonLabel>
                  <IonSelect
                    value={selectedSiteId}
                    placeholder="All Sites"
                    onIonChange={e => setSelectedSiteId(e.detail.value)}
                  >
                    <IonSelectOption value="all">All Sites</IonSelectOption>
                    {sites.map(s => (
                      <IonSelectOption key={s.id} value={s.id}>
                        {s.site_name}
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                </IonItem>
              </IonCol>
            </IonRow>
          </IonGrid>
        </IonCardContent>
      </IonCard>

      {/* Leaflet Map Overview */}
      {!loading && sites.length === 0 && records.length === 0 ? (
        <IonCard style={{ margin: '0 0 24px 0', borderRadius: '12px', textAlign: 'center', padding: '36px 20px' }}>
          <IonCardContent>
            <IonIcon icon={mapOutline} style={{ fontSize: '52px', color: '#94a3b8', marginBottom: '12px' }} />
            <h3 style={{ margin: '0 0 8px 0', color: '#1e293b', fontWeight: 'bold', fontSize: '18px' }}>
              No Spatial Map Data Available
            </h3>
            <p style={{ margin: '0 auto', color: '#64748b', fontSize: '14px', maxWidth: '460px', lineHeight: '1.5' }}>
              No monitoring sites or sensor readings have been added yet. Add a monitoring site or submit inspection readings to display the interactive spatial map.
            </p>
          </IonCardContent>
        </IonCard>
      ) : (
        <IonCard style={{ margin: '0 0 24px 0', borderRadius: '12px', overflow: 'hidden' }}>
          <IonCardHeader style={{ paddingBottom: '8px' }}>
            <IonCardTitle style={{ fontSize: '16px', fontWeight: 'bold' }}>
              Interactive Spatial Map & Odor Dispersion
            </IonCardTitle>
          </IonCardHeader>
          <IonCardContent style={{ padding: '0 16px 16px 16px' }}>
            <FullMapView
              centerLat={activeSiteObj?.current_latitude ?? activeSiteObj?.latitude ?? 8.3683}
              centerLng={activeSiteObj?.current_longitude ?? activeSiteObj?.longitude ?? 124.8637}
              readings={mapMarkers}
              height="440px"
            />
          </IonCardContent>
        </IonCard>
      )}

      {/* Sensor Data Grid List */}
      <h3 style={{ margin: '0 0 12px 4px', fontSize: '18px', fontWeight: 'bold', color: '#1e293b' }}>
        Sensor Readings & Inspection Photos ({records.length})
      </h3>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <IonSpinner />
          <p>Loading inspection logs...</p>
        </div>
      ) : records.length === 0 ? (
        <IonCard style={{ textAlign: 'center', padding: '32px' }}>
          <p style={{ color: '#64748b' }}>No inspection sensor data found for selected filter.</p>
        </IonCard>
      ) : (
        <IonGrid style={{ padding: 0 }}>
          <IonRow>
            {records.map(record => {
              const isDanger = record.ammonia > 50;
              const isWarning = record.ammonia > 25 && record.ammonia <= 50;

              return (
                <IonCol key={record.id} size="12" size-md="6" size-lg="4">
                  <IonCard style={{ height: '100%', margin: 0, borderRadius: '12px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <IonCardContent style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px', flexWrap: 'wrap', gap: '4px' }}>
                        <IonBadge color={isDanger ? 'danger' : isWarning ? 'warning' : 'success'}>
                          NH₃: {record.ammonia?.toFixed(1) || '0'} ppm
                        </IonBadge>

                        {record.is_pending_sync && <PendingSyncBadge />}
                      </div>

                      {record.photo_url ? (
                        <div
                          style={{
                            position: 'relative',
                            width: '100%',
                            height: '140px',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            marginTop: '8px',
                            marginBottom: '10px',
                            cursor: 'pointer',
                            backgroundColor: '#0f172a'
                          }}
                          onClick={() => {
                            setSelectedPhotoRecord(record);
                            setShowPhotoModal(true);
                          }}
                        >
                          <img
                            src={record.photo_url}
                            alt="Inspection Photo"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                          <div style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            background: 'rgba(0,0,0,0.65)',
                            padding: '4px 8px',
                            color: '#ffffff',
                            fontSize: '11px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            <IonIcon icon={imageOutline} /> View Stamped EXIF Photo
                          </div>
                        </div>
                      ) : (
                        <div style={{ height: '8px' }}></div>
                      )}

                      <div style={{ fontSize: '12px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div>
                          <IonIcon icon={hardwareChipOutline} style={{ marginRight: '4px' }} />
                          <b>Device:</b> {record.device_uid}
                        </div>
                        {record.latitude && record.longitude && (
                          <div>
                            <IonIcon icon={locationOutline} style={{ marginRight: '4px' }} />
                            <b>GPS:</b> {record.latitude.toFixed(5)}°, {record.longitude.toFixed(5)}°
                          </div>
                        )}
                        <div>
                          <IonIcon icon={calendarOutline} style={{ marginRight: '4px' }} />
                          <b>Date:</b> {new Date(record.created_at).toLocaleString()}
                        </div>
                      </div>
                    </IonCardContent>

                    {record.photo_url && (
                      <div style={{ padding: '0 16px 12px 16px' }}>
                        <IonButton
                          expand="block"
                          fill="outline"
                          size="small"
                          onClick={() => {
                            setSelectedPhotoRecord(record);
                            setShowPhotoModal(true);
                          }}
                        >
                          <IonIcon icon={eyeOutline} slot="start" /> View Photo & EXIF
                        </IonButton>
                      </div>
                    )}
                  </IonCard>
                </IonCol>
              );
            })}
          </IonRow>
        </IonGrid>
      )}

      {/* Photo Modal with EXIF Data details */}
      <IonModal isOpen={showPhotoModal} onDidDismiss={() => setShowPhotoModal(false)}>
        <div style={{ padding: '20px', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ marginTop: 0, fontWeight: 'bold' }}>EXIF Stamped Inspection Photo</h2>
          {selectedPhotoRecord && (
            <>
              <div style={{ width: '100%', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#0f172a', marginBottom: '16px' }}>
                <img
                  src={selectedPhotoRecord.photo_url}
                  alt="Full Inspection Photo"
                  style={{ width: '100%', maxHeight: '420px', objectFit: 'contain' }}
                />
              </div>

              <IonCard style={{ margin: '0 0 16px 0', borderRadius: '12px' }}>
                <IonCardContent>
                  <h4 style={{ margin: '0 0 12px 0', fontWeight: 'bold' }}>Embedded EXIF Metadata</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '13px' }}>
                    <div><b>Ammonia Level:</b> {selectedPhotoRecord.ammonia} ppm</div>
                    <div><b>Latitude:</b> {selectedPhotoRecord.latitude?.toFixed(6) || 'N/A'}</div>
                    <div><b>Longitude:</b> {selectedPhotoRecord.longitude?.toFixed(6) || 'N/A'}</div>
                    <div><b>Timestamp:</b> {new Date(selectedPhotoRecord.created_at).toLocaleString()}</div>
                    <div><b>Device UID:</b> {selectedPhotoRecord.device_uid}</div>
                  </div>
                </IonCardContent>
              </IonCard>
            </>
          )}

          <IonButton expand="block" color="medium" onClick={() => setShowPhotoModal(false)}>
            Close Photo Viewer
          </IonButton>
        </div>
      </IonModal>
    </div>
  );
};

export default AdminSensorDataViewer;
