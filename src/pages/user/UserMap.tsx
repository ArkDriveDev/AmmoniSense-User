import React, { useEffect, useState } from 'react';
import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButton,
  IonButtons,
  IonIcon,
  IonSpinner,
  IonSearchbar,
  IonBadge,
  IonCard,
  IonToast,
  IonModal,
  IonPopover
} from '@ionic/react';
import {
  refreshOutline,
  locateOutline,
  layersOutline,
  informationCircleOutline,
  closeOutline,
  hardwareChipOutline,
  eyeOutline,
  locationOutline,
  trashOutline
} from 'ionicons/icons';

import { supabase } from '../../services/supabase';
import offlineStorage from '../../services/OfflineStorageService';
import { fetchOdorZones, fetchCommunityPolygons, deleteSite } from '../../services/siteService';
import { OdorZone, CommunityPolygon } from '../../types/site';
import FullMapView, {
  SiteMarkerData,
  ReadingMarkerData,
  PhotoTagMarkerData,
  SITE_BRAND_COLOR,
  PHOTO_TAG_BRAND_COLOR,
  getAmmoniaColor,
  getAmmoniaSeverityLabel
} from '../../components/map/FullMapView';
import { Geolocation } from '@capacitor/geolocation';
import { useNavigate } from 'react-router-dom';
import PendingSyncBadge from '../../components/common/PendingSyncBadge';

// Default Center Coordinates: Manolo Fortich Municipality
const MANOLO_FORTICH_CENTER = { lat: 8.3683, lng: 124.8637, zoom: 13 };

const IS_IN_MANOLO_FORTICH = (lat?: number, lng?: number): boolean => {
  if (!lat || !lng) return false;
  return lat >= 8.2200 && lat <= 8.5000 && lng >= 124.7000 && lng <= 125.0200;
};

export default function UserMap() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(true);
  const [sites, setSites] = useState<SiteMarkerData[]>([]);
  const [readings, setReadings] = useState<ReadingMarkerData[]>([]);
  const [photoTags, setPhotoTags] = useState<PhotoTagMarkerData[]>([]);
  const [odorZones, setOdorZones] = useState<OdorZone[]>([]);
  const [communityPolygons, setCommunityPolygons] = useState<CommunityPolygon[]>([]);

  // Search input
  const [searchText, setSearchText] = useState<string>('');

  // Layer Toggles
  const [showSitesLayer, setShowSitesLayer] = useState<boolean>(true);
  const [showReadingsLayer, setShowReadingsLayer] = useState<boolean>(true);
  const [showPhotoTagsLayer, setShowPhotoTagsLayer] = useState<boolean>(true);
  const [showBoundaryLayer, setShowBoundaryLayer] = useState<boolean>(true);
  const [showOdorZonesLayer, setShowOdorZonesLayer] = useState<boolean>(true);

  // Navigation & Location
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number; zoom?: number }>(MANOLO_FORTICH_CENTER);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState<boolean>(false);

  // Bottom Sheet Details State
  const [selectedSite, setSelectedSite] = useState<SiteMarkerData | null>(null);
  const [selectedReading, setSelectedReading] = useState<ReadingMarkerData | null>(null);
  const [selectedPhotoTag, setSelectedPhotoTag] = useState<PhotoTagMarkerData | null>(null);

  // Modals & UI Toggles
  const [showLegend, setShowLegend] = useState<boolean>(false);
  const [showLayerPopover, setShowLayerPopover] = useState<boolean>(false);
  const [popoverEvent, setPopoverEvent] = useState<any>(null);
  const [showPhotoModal, setShowPhotoModal] = useState<boolean>(false);

  // Toasts
  const [toastMsg, setToastMsg] = useState<string>('');
  const [showToast, setShowToast] = useState<boolean>(false);

  useEffect(() => {
    loadMapData();

    const handleSiteChanged = () => {
      fetchSites();
    };

    window.addEventListener('site_deleted', handleSiteChanged);
    window.addEventListener('site_synced', handleSiteChanged);

    return () => {
      window.removeEventListener('site_deleted', handleSiteChanged);
      window.removeEventListener('site_synced', handleSiteChanged);
    };
  }, []);

  const loadMapData = async () => {
    setLoading(true);
    await Promise.all([
      fetchSites(),
      fetchReadings(),
      fetchPhotoTags(),
      loadPolygons()
    ]);
    setLoading(false);
  };

  const loadPolygons = async () => {
    try {
      const [zones, comms] = await Promise.all([
        fetchOdorZones(),
        fetchCommunityPolygons()
      ]);
      setOdorZones(zones);
      setCommunityPolygons(comms);
    } catch (e) {
      console.warn('Error loading polygons in UserMap:', e);
    }
  };

  const resolveSiteCoords = (latRaw?: any, lngRaw?: any) => {
    let lat = typeof latRaw === 'number' ? latRaw : parseFloat(latRaw);
    let lng = typeof lngRaw === 'number' ? lngRaw : parseFloat(lngRaw);

    if (isNaN(lat) || isNaN(lng) || !IS_IN_MANOLO_FORTICH(lat, lng)) {
      return { latitude: 8.3683, longitude: 124.8637 };
    }
    return { latitude: lat, longitude: lng };
  };

  const fetchSites = async () => {
    let onlineFormatted: SiteMarkerData[] = [];
    try {
      const { data: sitesData, error: sitesErr } = await supabase
        .from('monitoring_sites')
        .select('*');

      if (!sitesErr && sitesData) {
        onlineFormatted = sitesData.map((s: any) => {
          const coords = resolveSiteCoords(s.current_latitude, s.current_longitude);
          return {
            id: s.id,
            site_code: s.site_code,
            site_name: s.site_name,
            site_type: s.site_type || 'Agricultural',
            address: s.address,
            latitude: coords.latitude,
            longitude: coords.longitude,
            grid_cell_id: s.current_grid_cell_id || 'A1',
            owner_name: 'Inspector Owner',
            photo_url: s.site_photo_thumbnail || s.site_photo_url,
            isOffline: false,
            is_pending_sync: false,
          };
        });
      } else if (sitesErr) {
        console.warn('Supabase fetch sites error:', sitesErr.message);
      }
    } catch (err) {
      console.warn('Network error or offline mode while fetching monitoring sites from Supabase:', err);
    }

    const onlineCodes = new Set(onlineFormatted.map((s) => s.site_code).filter(Boolean));

    let offlineFormatted: SiteMarkerData[] = [];
    try {
      // 1. Fetch from IndexedDB offline_sites store (filtering out deleted / synced items)
      const offlineRecords = await offlineStorage.getOfflineSites();
      const idbOfflineFormatted: SiteMarkerData[] = offlineRecords
        .filter((os: any) => !os.isDeleted && !onlineCodes.has(os.site_code))
        .map((os: any) => {
          const coords = resolveSiteCoords(
            os.current_latitude ?? os.latitude,
            os.current_longitude ?? os.longitude
          );

          return {
            id: os.id,
            site_code: os.site_code || 'OFFLINE',
            site_name: os.site_name || 'Offline Site',
            site_type: os.site_type || 'Agricultural',
            address: os.address || os.site_name,
            latitude: coords.latitude,
            longitude: coords.longitude,
            grid_cell_id: os.current_grid_cell_id || os.grid_cell_id || 'A1',
            owner_name: os.owner?.owner_name || 'Inspector Owner',
            photo_url: os.site_photo_thumbnail || os.site_photo_url || os.photo_url,
            isOffline: true,
            is_pending_sync: true,
          };
        });

      // 2. Fetch from IndexedDB offline queue ('SITE_REGISTRATION')
      let queuedOfflineFormatted: SiteMarkerData[] = [];
      try {
        const queue = await offlineStorage.getQueue();
        queuedOfflineFormatted = queue
          .filter((q) => q.type === 'SITE_REGISTRATION' && q.payload && !onlineCodes.has(q.payload.site_code))
          .map((q) => {
            const p = q.payload;
            const coords = resolveSiteCoords(
              p.current_latitude ?? p.latitude,
              p.current_longitude ?? p.longitude
            );

            return {
              id: q.id || `queue_${Date.now()}`,
              site_code: p.site_code || 'QUEUED',
              site_name: p.site_name || 'Unsubmitted Site',
              site_type: p.site_type || 'Agricultural',
              address: p.address || p.site_name,
              latitude: coords.latitude,
              longitude: coords.longitude,
              grid_cell_id: p.current_grid_cell_id || p.grid_cell_id || 'A1',
              owner_name: 'Inspector Owner',
              photo_url: p.site_photo_url || p.photo_url,
              isOffline: true,
              is_pending_sync: true,
            };
          });
      } catch (qErr) {
        console.warn('Error fetching queued site registrations:', qErr);
      }

      // 3. Check localStorage fallback for 'offline_sites', purging synced/deleted
      let lsOfflineFormatted: SiteMarkerData[] = [];
      try {
        const lsStr = localStorage.getItem('offline_sites');
        if (lsStr) {
          const lsArr = JSON.parse(lsStr);
          if (Array.isArray(lsArr)) {
            const validLsArr = lsArr.filter((os: any) => !os.isDeleted && !onlineCodes.has(os.site_code));
            if (validLsArr.length !== lsArr.length) {
              localStorage.setItem('offline_sites', JSON.stringify(validLsArr));
            }

            lsOfflineFormatted = validLsArr.map((os: any) => {
              const coords = resolveSiteCoords(
                os.current_latitude ?? os.latitude,
                os.current_longitude ?? os.longitude
              );
              return {
                id: os.id || `ls_${Date.now()}`,
                site_code: os.site_code || 'LS_OFFLINE',
                site_name: os.site_name || 'Offline Site',
                site_type: os.site_type || 'Agricultural',
                address: os.address || os.site_name,
                latitude: coords.latitude,
                longitude: coords.longitude,
                grid_cell_id: os.current_grid_cell_id || os.grid_cell_id || 'A1',
                owner_name: os.owner?.owner_name || 'Inspector Owner',
                photo_url: os.site_photo_thumbnail || os.site_photo_url,
                isOffline: true,
                is_pending_sync: true,
              };
            });
          }
        }
      } catch (lsErr) {
        console.warn('Error reading localStorage offline_sites:', lsErr);
      }

      // Deduplicate all offline records by id
      const offlineMap = new Map<string | number, SiteMarkerData>();
      [...idbOfflineFormatted, ...queuedOfflineFormatted, ...lsOfflineFormatted].forEach((item) => {
        if (!onlineCodes.has(item.site_code)) {
          offlineMap.set(item.id, item);
        }
      });
      offlineFormatted = Array.from(offlineMap.values());
    } catch (err) {
      console.error('Error loading offline sites for map:', err);
    }

    // Combine offline sites and online sites, avoiding duplicates if online has synced an offline site ID
    const combinedMap = new Map<string | number, SiteMarkerData>();
    // First add offline sites (unsubmitted / pending sync)
    offlineFormatted.forEach((s) => combinedMap.set(s.id, s));
    // Then add online sites
    onlineFormatted.forEach((s) => combinedMap.set(s.id, s));

    const finalSites = Array.from(combinedMap.values());
    console.log('📍 Total sites loaded for map display:', finalSites.length, finalSites);
    setSites(finalSites);
  };

  const fetchReadings = async () => {
    let serverReadings: ReadingMarkerData[] = [];
    try {
      const { data, error } = await supabase
        .from('sensor_data')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (!error && data) {
        serverReadings = data
          .map((r: any) => ({
            id: r.id,
            ammonia: r.ammonia || 0,
            temperature: r.temperature,
            humidity: r.humidity,
            battery: r.battery,
            latitude: r.latitude || 8.3683,
            longitude: r.longitude || 124.8637,
            grid_cell_id: r.grid_cell_id,
            device_uid: r.device_uid,
            created_at: r.created_at,
            photo_url: r.photo_url,
            is_pending_sync: false,
          }))
          .filter((r) => IS_IN_MANOLO_FORTICH(r.latitude, r.longitude));
      }
    } catch (err) {
      console.warn('Error fetching sensor data:', err);
    }

    try {
      const queue = await offlineStorage.getQueue();
      const offlineReadings: ReadingMarkerData[] = queue
        .filter((q) => q.type === 'SENSOR_READING')
        .map((q) => ({
          id: q.id,
          ammonia: q.payload.ammonia || 0,
          temperature: q.payload.temperature,
          humidity: q.payload.humidity,
          battery: q.payload.battery,
          latitude: q.payload.latitude || 8.3683,
          longitude: q.payload.longitude || 124.8637,
          grid_cell_id: q.payload.grid_cell_id,
          device_uid: q.payload.device_uid || 'OFFLINE-NODE',
          created_at: q.timestamp,
          photo_url: q.payload.photo_url,
          is_pending_sync: true,
        }))
        .filter((r) => IS_IN_MANOLO_FORTICH(r.latitude, r.longitude));

      setReadings([...offlineReadings, ...serverReadings]);
    } catch (e) {
      console.error('Error reading offline queue:', e);
      setReadings(serverReadings);
    }
  };

  const fetchPhotoTags = async () => {
    let serverPhotoTags: PhotoTagMarkerData[] = [];
    try {
      const { data, error } = await supabase
        .from('inspection_photos')
        .select('*')
        .order('uploaded_at', { ascending: false })
        .limit(200);

      if (!error && data) {
        serverPhotoTags = data
          .map((p: any) => ({
            id: p.id,
            latitude: p.latitude || 8.3683,
            longitude: p.longitude || 124.8637,
            photo_url: p.photo_url,
            grid_cell_id: p.grid_cell_id,
            site_id: p.site_id,
            site_name: 'Inspection Site',
            is_used: p.is_used,
            uploaded_at: p.uploaded_at,
            is_pending_sync: false,
          }))
          .filter((pt) => IS_IN_MANOLO_FORTICH(pt.latitude, pt.longitude));
      }
    } catch (err) {
      console.warn('Error fetching inspection photo tags:', err);
    }

    try {
      const queue = await offlineStorage.getQueue();
      const offlinePhotoTags: PhotoTagMarkerData[] = queue
        .filter((q) => q.type === 'SENSOR_READING' && q.payload?.photo_url)
        .map((q) => ({
          id: q.id,
          latitude: q.payload.latitude || 8.3683,
          longitude: q.payload.longitude || 124.8637,
          photo_url: q.payload.photo_url,
          grid_cell_id: q.payload.grid_cell_id,
          site_id: q.payload.site_id || null,
          site_name: 'Offline Inspection Tag',
          is_used: false,
          uploaded_at: q.timestamp,
          is_pending_sync: true,
        }))
        .filter((pt) => IS_IN_MANOLO_FORTICH(pt.latitude, pt.longitude));

      setPhotoTags([...offlinePhotoTags, ...serverPhotoTags]);
    } catch (e) {
      console.error('Error reading offline photo tags queue:', e);
      setPhotoTags(serverPhotoTags);
    }
  };

  // Filter photo tags by search query
  const filteredPhotoTags = photoTags.filter((tag) => {
    if (!searchText.trim()) return true;
    const query = searchText.toLowerCase();
    return (
      tag.site_name?.toLowerCase().includes(query) ||
      tag.id.toString().includes(query)
    );
  });

  // Filter sites by search query
  const filteredSites = sites.filter((site) => {
    if (!searchText.trim()) return true;
    const query = searchText.toLowerCase();
    return (
      site.site_name.toLowerCase().includes(query) ||
      site.site_code?.toLowerCase().includes(query) ||
      site.address?.toLowerCase().includes(query) ||
      site.owner_name?.toLowerCase().includes(query)
    );
  });

  // Filter readings by search query
  const filteredReadings = readings.filter((reading) => {
    if (!searchText.trim()) return true;
    const query = searchText.toLowerCase();
    return (
      reading.device_uid?.toLowerCase().includes(query) ||
      reading.ammonia.toString().includes(query)
    );
  });

  // Locate User GPS
  const handleLocateUser = async () => {
    setLocating(true);
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      if (IS_IN_MANOLO_FORTICH(lat, lng)) {
        setUserLocation({ lat, lng });
        setMapCenter({ lat, lng, zoom: 15 });
        setToastMsg('📍 Centered on your location in Manolo Fortich');
      } else {
        setMapCenter(MANOLO_FORTICH_CENTER);
        setToastMsg('📍 Your GPS location is outside Manolo Fortich. Map view is restricted to Manolo Fortich.');
      }
      setShowToast(true);
    } catch (err: any) {
      console.warn('Geolocation error:', err);
      setToastMsg('Could not acquire current GPS location');
      setShowToast(true);
    } finally {
      setLocating(false);
    }
  };

  const closeBottomSheet = () => {
    setSelectedSite(null);
    setSelectedReading(null);
    setSelectedPhotoTag(null);
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar style={{ '--background': 'linear-gradient(135deg, #0F3C5C 0%, #1D5D9B 100%)', '--color': '#ffffff' }}>
          <IonTitle style={{ fontWeight: 700 }}>Monitoring Sites Map</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => setShowLegend(true)} style={{ color: '#ffffff' }}>
              <IonIcon icon={informationCircleOutline} slot="icon-only" />
            </IonButton>
            <IonButton
              onClick={(e) => {
                setPopoverEvent(e.nativeEvent);
                setShowLayerPopover(true);
              }}
              style={{ color: '#ffffff' }}
            >
              <IonIcon icon={layersOutline} slot="icon-only" />
            </IonButton>
            <IonButton onClick={loadMapData} style={{ color: '#ffffff' }}>
              <IonIcon icon={refreshOutline} slot="icon-only" />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent style={{ position: 'relative' }}>
        {/* Floating Top Search Bar */}
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            right: '12px',
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(8px)',
              borderRadius: '16px',
              boxShadow: '0 4px 20px rgba(15, 60, 92, 0.18)',
              padding: '2px 8px',
              border: '1px solid rgba(226, 232, 240, 0.8)',
            }}
          >
            <IonSearchbar
              value={searchText}
              onIonInput={(e) => setSearchText(e.detail.value!)}
              placeholder="Search site name, code, or address..."
              showClearButton="always"
              style={{ '--background': 'transparent', '--box-shadow': 'none', padding: 0 }}
            />
          </div>
        </div>

        {/* Map Canvas */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#F1F5F9' }}>
            <IonSpinner name="crescent" color="primary" />
            <p style={{ color: '#64748B', fontWeight: 600, marginTop: '12px' }}>Loading Manolo Fortich Monitoring Sites...</p>
          </div>
        ) : (
          <FullMapView
            sites={filteredSites}
            readings={filteredReadings}
            photoTags={filteredPhotoTags}
            showSitesLayer={showSitesLayer}
            showReadingsLayer={showReadingsLayer}
            showPhotoTagsLayer={showPhotoTagsLayer}
            showBoundaryLayer={showBoundaryLayer}
            showOdorZonesLayer={showOdorZonesLayer}
            odorZones={odorZones}
            communityPolygons={communityPolygons}
            centerLat={mapCenter.lat}
            centerLng={mapCenter.lng}
            zoom={mapCenter.zoom}
            userLocation={userLocation}
            onSelectSite={(site) => {
              closeBottomSheet();
              setSelectedSite(site);
            }}
            onSelectReading={(reading) => {
              closeBottomSheet();
              setSelectedReading(reading);
            }}
            onSelectPhotoTag={(tag) => {
              closeBottomSheet();
              setSelectedPhotoTag(tag);
            }}
          />
        )}

        {/* Floating Right Control Action Buttons */}
        <div
          style={{
            position: 'absolute',
            bottom: '32px',
            right: '16px',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {/* Locate GPS Button */}
          <IonButton
            size="small"
            shape="round"
            onClick={handleLocateUser}
            disabled={locating}
            style={{
              '--background': 'linear-gradient(135deg, #1D5D9B 0%, #0F3C5C 100%)',
              '--color': '#ffffff',
              '--box-shadow': '0 4px 14px rgba(0,0,0,0.25)',
              width: '44px',
              height: '44px',
            }}
          >
            {locating ? <IonSpinner name="crescent" style={{ width: '20px', height: '20px' }} /> : <IonIcon icon={locateOutline} style={{ fontSize: '22px' }} />}
          </IonButton>
        </div>

        {/* BOTTOM SHEET DETAIL DRAWER */}
        {(selectedSite || selectedReading || selectedPhotoTag) && (
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              zIndex: 1050,
              background: '#ffffff',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              boxShadow: '0 -8px 30px rgba(15, 60, 92, 0.25)',
              padding: '20px',
              maxHeight: '75vh',
              overflowY: 'auto',
            }}
          >
            {/* Drawer Header Handle & Close Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ width: '40px', height: '4px', background: '#cbd5e1', borderRadius: '2px', margin: '0 auto' }}></div>
              <IonButton fill="clear" size="small" onClick={closeBottomSheet} style={{ position: 'absolute', right: '12px', top: '12px', color: '#64748b' }}>
                <IonIcon icon={closeOutline} style={{ fontSize: '24px' }} />
              </IonButton>
            </div>

            {/* SITE DETAILS */}
            {selectedSite && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                  <IonBadge style={{ background: selectedSite.isOffline ? '#ef4444' : SITE_BRAND_COLOR, color: '#ffffff', padding: '4px 8px', borderRadius: '6px' }}>
                    {selectedSite.site_type || 'Agricultural'}
                  </IonBadge>
                  <span style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace', fontWeight: 600 }}>
                    {selectedSite.site_code}
                  </span>
                  {selectedSite.isOffline && <PendingSyncBadge />}
                </div>

                <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>
                  {selectedSite.site_name}
                </h2>

                <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <IonIcon icon={locationOutline} style={{ color: '#1d5d9b' }} />
                  {selectedSite.address || 'Manolo Fortich, Bukidnon'}
                </p>

                {selectedSite.photo_url && (
                  <div style={{ width: '100%', height: '150px', borderRadius: '12px', overflow: 'hidden', marginBottom: '14px' }}>
                    <img src={selectedSite.photo_url} alt={selectedSite.site_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#f8fafc', padding: '12px', borderRadius: '12px', marginBottom: '16px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Owner / Operator</span>
                    <strong style={{ color: '#0f172a' }}>{selectedSite.owner_name}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Municipality</span>
                    <strong style={{ color: '#0f172a' }}>Manolo Fortich</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Coordinates</span>
                    <strong style={{ color: '#0f172a' }}>{selectedSite.latitude.toFixed(4)}°, {selectedSite.longitude.toFixed(4)}°</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Status</span>
                    <strong style={{ color: '#10b981' }}>Active Site</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <IonButton
                    expand="block"
                    className="btn-ammoni btn-primary"
                    style={{ flex: 1 }}
                    onClick={() => {
                      closeBottomSheet();
                      navigate(`/devices?site=${selectedSite.id}`);
                    }}
                  >
                    <IonIcon icon={hardwareChipOutline} slot="start" />
                    View Site Devices
                  </IonButton>

                  <IonButton
                    expand="block"
                    color="danger"
                    fill="outline"
                    onClick={async () => {
                      if (window.confirm(`Are you sure you want to delete monitoring site "${selectedSite.site_name}"?`)) {
                        try {
                          await deleteSite(selectedSite.id);
                          closeBottomSheet();
                          setToastMsg(`Monitoring site "${selectedSite.site_name}" deleted successfully.`);
                          setShowToast(true);
                          fetchSites();
                        } catch (err: any) {
                          setToastMsg(err.message || 'Failed to delete site.');
                          setShowToast(true);
                        }
                      }
                    }}
                  >
                    <IonIcon icon={trashOutline} slot="icon-only" />
                  </IonButton>
                </div>
              </div>
            )}

            {/* SENSOR READING DETAILS */}
            {selectedReading && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Sensor Reading Detail</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                      <span
                        style={{
                          fontSize: '22px',
                          fontWeight: 800,
                          color: getAmmoniaColor(selectedReading.ammonia),
                        }}
                      >
                        {selectedReading.ammonia.toFixed(1)} PPM
                      </span>
                      <IonBadge style={{ background: getAmmoniaColor(selectedReading.ammonia), color: '#ffffff' }}>
                        {getAmmoniaSeverityLabel(selectedReading.ammonia)}
                      </IonBadge>
                      {selectedReading.is_pending_sync && <PendingSyncBadge />}
                    </div>
                  </div>
                </div>

                {selectedReading.photo_url && (
                  <div style={{ width: '100%', height: '140px', borderRadius: '12px', overflow: 'hidden', marginBottom: '14px' }}>
                    <img src={selectedReading.photo_url} alt="Reading Photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#f8fafc', padding: '12px', borderRadius: '12px', marginBottom: '16px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Device UID</span>
                    <strong style={{ color: '#0f172a' }}>{selectedReading.device_uid || 'N/A'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Location</span>
                    <strong style={{ color: '#0f172a' }}>Manolo Fortich</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Temperature / Humidity</span>
                    <strong style={{ color: '#0f172a' }}>
                      {selectedReading.temperature ? `${selectedReading.temperature}°C` : 'N/A'} / {selectedReading.humidity ? `${selectedReading.humidity}%` : 'N/A'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Recorded At</span>
                    <strong style={{ color: '#0f172a' }}>{new Date(selectedReading.created_at).toLocaleString()}</strong>
                  </div>
                </div>

                {selectedReading.photo_url && (
                  <IonButton
                    expand="block"
                    fill="outline"
                    onClick={() => setShowPhotoModal(true)}
                  >
                    <IonIcon icon={eyeOutline} slot="start" /> View Inspection Photo
                  </IonButton>
                )}
              </div>
            )}

            {/* PHOTO TAG DETAILS */}
            {selectedPhotoTag && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 600 }}>Inspection Photo Tag (Step 1)</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                      <span style={{ fontSize: '18px', fontWeight: 800, color: '#8b5cf6' }}>
                        📷 Inspection Tag #{selectedPhotoTag.id}
                      </span>
                      <IonBadge style={{ background: selectedPhotoTag.is_used ? '#6366f1' : '#8b5cf6', color: '#ffffff' }}>
                        {selectedPhotoTag.is_used ? 'Step 1 Tag Submitted' : 'Step 1 Active Tag'}
                      </IonBadge>
                      {selectedPhotoTag.is_pending_sync && <PendingSyncBadge />}
                    </div>
                  </div>
                </div>

                {selectedPhotoTag.photo_url && (
                  <div style={{ width: '100%', height: '180px', borderRadius: '12px', overflow: 'hidden', marginBottom: '14px' }}>
                    <img src={selectedPhotoTag.photo_url} alt="Inspection Photo Tag" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#f8fafc', padding: '12px', borderRadius: '12px', marginBottom: '16px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Site</span>
                    <strong style={{ color: '#0f172a' }}>{selectedPhotoTag.site_name || 'Inspection Site'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Coordinates</span>
                    <strong style={{ color: '#0f172a' }}>{selectedPhotoTag.latitude.toFixed(5)}°, {selectedPhotoTag.longitude.toFixed(5)}°</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Captured / Uploaded</span>
                    <strong style={{ color: '#0f172a' }}>
                      {selectedPhotoTag.uploaded_at ? new Date(selectedPhotoTag.uploaded_at).toLocaleString() : 'Recent'}
                    </strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                  <IonButton
                    expand="block"
                    fill="outline"
                    style={{ flex: 1 }}
                    onClick={() => {
                      setShowPhotoModal(true);
                    }}
                  >
                    <IonIcon icon={eyeOutline} slot="start" /> Full Photo View
                  </IonButton>
                  <IonButton
                    expand="block"
                    className="btn-ammoni btn-primary"
                    style={{ flex: 1 }}
                    onClick={() => {
                      closeBottomSheet();
                      navigate('/my-sensor-data');
                    }}
                  >
                    Complete Inspection ➔
                  </IonButton>
                </div>
              </div>
            )}
          </div>
        )}

        {/* LAYER TOGGLE POPOVER */}
        <IonPopover
          isOpen={showLayerPopover}
          event={popoverEvent}
          onDidDismiss={() => setShowLayerPopover(false)}
        >
          <div style={{ padding: '16px', minWidth: '220px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontWeight: 700, color: '#0f172a', fontSize: '15px' }}>
              Map Layers
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showSitesLayer}
                  onChange={(e) => setShowSitesLayer(e.target.checked)}
                />
                <b>Monitoring Sites</b> (Pins)
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showReadingsLayer}
                  onChange={(e) => setShowReadingsLayer(e.target.checked)}
                />
                <b>Sensor Readings</b> (Dots)
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showPhotoTagsLayer}
                  onChange={(e) => setShowPhotoTagsLayer(e.target.checked)}
                />
                <b>Step 1 Photo Tags</b> (📷 Pins)
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showBoundaryLayer}
                  onChange={(e) => setShowBoundaryLayer(e.target.checked)}
                />
                <b>Manolo Fortich Boundary</b>
              </label>
            </div>
          </div>
        </IonPopover>

        {/* LEGEND MODAL */}
        <IonModal isOpen={showLegend} onDidDismiss={() => setShowLegend(false)}>
          <div style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0, fontWeight: 'bold', color: '#0f172a' }}>Map Legend</h2>
              <IonButton fill="clear" onClick={() => setShowLegend(false)}>
                <IonIcon icon={closeOutline} />
              </IonButton>
            </div>

            <IonCard className="premium-card" style={{ margin: '0 0 16px 0', padding: '14px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontWeight: 700, color: '#0f172a' }}>
                Monitoring Site Pins
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: SITE_BRAND_COLOR }}></span>
                  <b>Monitoring Site</b> (Synced Brand Marker)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#ef4444' }}></span>
                  <b>Unsynced Offline Site</b> (🔴 Pending Sync Indicator)
                </div>
              </div>
            </IonCard>

            <IonCard className="premium-card" style={{ margin: '0 0 16px 0', padding: '14px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontWeight: 700, color: '#0f172a' }}>
                Step 1 Inspection Photo Tags
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: PHOTO_TAG_BRAND_COLOR }}></span>
                  <b>Step 1 Photo Tag</b> (📷 Camera location tag from mobile inspection)
                </div>
              </div>
            </IonCard>

            <IonCard className="premium-card" style={{ margin: '0 0 20px 0', padding: '14px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontWeight: 700, color: '#0f172a' }}>
                Sensor Readings Ammonia Levels (PPM)
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#22c55e' }}></span>
                  <b>0 - 5 PPM:</b> Normal / Safe (Green)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#eab308' }}></span>
                  <b>5 - 10 PPM:</b> Warning Threshold (Yellow)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#f97316' }}></span>
                  <b>10 - 20 PPM:</b> High Concentration (Orange)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#ef4444' }}></span>
                  <b>&gt; 20 PPM:</b> Critical Alert (Red)
                </div>
              </div>
            </IonCard>

            <IonButton expand="block" className="btn-ammoni btn-primary" onClick={() => setShowLegend(false)}>
              Close Legend
            </IonButton>
          </div>
        </IonModal>

        {/* PHOTO MODAL */}
        <IonModal isOpen={showPhotoModal} onDidDismiss={() => setShowPhotoModal(false)}>
          <div style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
            <h2 style={{ marginTop: 0, fontWeight: 'bold' }}>Inspection Photo</h2>
            {(selectedReading?.photo_url || selectedPhotoTag?.photo_url) && (
              <div style={{ width: '100%', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#0f172a', marginBottom: '16px' }}>
                <img src={selectedReading?.photo_url || selectedPhotoTag?.photo_url} alt="Inspection Photo" style={{ width: '100%', maxHeight: '420px', objectFit: 'contain' }} />
              </div>
            )}
            <IonButton expand="block" color="medium" onClick={() => setShowPhotoModal(false)}>
              Close Photo Viewer
            </IonButton>
          </div>
        </IonModal>

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMsg}
          duration={3500}
          position="bottom"