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
  IonChip,
  IonLabel,
  IonBadge,
  IonCard,
  IonCardContent,
  IonToast,
  IonModal,
  IonPopover
} from '@ionic/react';
import {
  refreshOutline,
  locateOutline,
  layersOutline,
  informationCircleOutline,
  addOutline,
  closeOutline,
  businessOutline,
  hardwareChipOutline,
  chevronForwardOutline,
  eyeOutline,
  calendarOutline,
  locationOutline,
  funnelOutline,
  checkmarkCircleOutline
} from 'ionicons/icons';

import { supabase } from '../../services/supabase';
import offlineStorage from '../../services/OfflineStorageService';
import FullMapView, {
  SiteMarkerData,
  ReadingMarkerData,
  getSiteTypeColor,
  getAmmoniaColor,
  getAmmoniaSeverityLabel
} from '../../components/map/FullMapView';
import { Geolocation } from '@capacitor/geolocation';
import { useNavigate } from 'react-router-dom';
import PendingSyncBadge from '../../components/common/PendingSyncBadge';

export default function UserMap() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState<boolean>(true);
  const [sites, setSites] = useState<SiteMarkerData[]>([]);
  const [readings, setReadings] = useState<ReadingMarkerData[]>([]);

  // Search and Filters
  const [searchText, setSearchText] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'piggery' | 'ambient' | 'critical' | 'warning'>('all');

  // Layer Toggles
  const [showSitesLayer, setShowSitesLayer] = useState<boolean>(true);
  const [showReadingsLayer, setShowReadingsLayer] = useState<boolean>(true);
  const [showGridLayer, setShowGridLayer] = useState<boolean>(true);
  const [showBoundaryLayer, setShowBoundaryLayer] = useState<boolean>(true);

  // Map Navigation State
  const MANOLO_FORTICH_CENTER = { lat: 8.3683, lng: 124.8637, zoom: 13 };
  const [mapCenter, setMapCenter] = useState<{ lat: number; lng: number; zoom?: number }>(MANOLO_FORTICH_CENTER);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState<boolean>(false);

  // Bottom Sheet Details State
  const [selectedSite, setSelectedSite] = useState<SiteMarkerData | null>(null);
  const [selectedReading, setSelectedReading] = useState<ReadingMarkerData | null>(null);
  const [selectedGridCell, setSelectedGridCell] = useState<{ id: string; readings: ReadingMarkerData[] } | null>(null);

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
  }, []);

  const loadMapData = async () => {
    setLoading(true);
    await Promise.all([fetchSites(), fetchReadings()]);
    setLoading(false);
  };

  const fetchSites = async () => {
    try {
      const { data: sitesData, error: sitesErr } = await supabase
        .from('monitoring_sites')
        .select(`
          id,
          site_code,
          site_name,
          site_type,
          address,
          current_latitude,
          current_longitude,
          current_grid_cell_id,
          site_owners (
            owner_name
          ),
          inspection_photos (
            photo_url
          )
        `);

      if (!sitesErr && sitesData) {
        const formattedSites: SiteMarkerData[] = sitesData.map((s: any) => ({
          id: s.id,
          site_code: s.site_code,
          site_name: s.site_name,
          site_type: s.site_type || 'Agricultural',
          address: s.address,
          latitude: s.current_latitude || 8.3683,
          longitude: s.current_longitude || 124.8637,
          grid_cell_id: s.current_grid_cell_id || 'A1',
          owner_name: s.site_owners?.owner_name || 'Inspector Owner',
          photo_url: Array.isArray(s.inspection_photos)
            ? s.inspection_photos[0]?.photo_url
            : s.inspection_photos?.photo_url,
        }));
        setSites(formattedSites);
      }
    } catch (err) {
      console.error('Error fetching monitoring sites:', err);
    }
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
        serverReadings = data.map((r: any) => ({
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
        }));
      }
    } catch (err) {
      console.warn('Error fetching sensor data:', err);
    }

    // Include offline pending queue sensor readings
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
        }));

      setReadings([...offlineReadings, ...serverReadings]);
    } catch (e) {
      console.error('Error reading offline queue:', e);
      setReadings(serverReadings);
    }
  };

  // Filter sites according to search text & filter chip
  const filteredSites = sites.filter((site) => {
    if (activeFilter === 'critical' || activeFilter === 'warning') return false; // Filter applies to readings
    if (activeFilter === 'piggery' && !site.site_type?.toLowerCase().includes('piggery')) return false;
    if (activeFilter === 'ambient' && !site.site_type?.toLowerCase().includes('ambient') && !site.site_type?.toLowerCase().includes('agricultural')) return false;

    if (!searchText.trim()) return true;
    const query = searchText.toLowerCase();
    return (
      site.site_name.toLowerCase().includes(query) ||
      site.site_code?.toLowerCase().includes(query) ||
      site.address?.toLowerCase().includes(query) ||
      site.owner_name?.toLowerCase().includes(query)
    );
  });

  // Filter readings according to search text & filter chip
  const filteredReadings = readings.filter((reading) => {
    if (activeFilter === 'piggery' || activeFilter === 'ambient') return false;
    if (activeFilter === 'critical' && reading.ammonia <= 20) return false;
    if (activeFilter === 'warning' && (reading.ammonia <= 5 || reading.ammonia > 20)) return false;

    if (!searchText.trim()) return true;
    const query = searchText.toLowerCase();
    return (
      reading.device_uid?.toLowerCase().includes(query) ||
      reading.grid_cell_id?.toLowerCase().includes(query) ||
      reading.ammonia.toString().includes(query)
    );
  });

  // Locate User GPS
  const handleLocateUser = async () => {
    setLocating(true);
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      const userCoords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setUserLocation(userCoords);
      setMapCenter({ ...userCoords, zoom: 16 });
      setToastMsg('📍 Centered on your current GPS location');
      setShowToast(true);
    } catch (err: any) {
      console.warn('Geolocation error:', err);
      setToastMsg('Could not acquire current GPS location');
      setShowToast(true);
    } finally {
      setLocating(false);
    }
  };

  // Center on Manolo Fortich
  const handleCenterManoloFortich = () => {
    setMapCenter(MANOLO_FORTICH_CENTER);
    setToastMsg('📍 Centered on Manolo Fortich, Bukidnon');
    setShowToast(true);
  };

  const closeBottomSheet = () => {
    setSelectedSite(null);
    setSelectedReading(null);
    setSelectedGridCell(null);
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar style={{ '--background': 'linear-gradient(135deg, #0F3C5C 0%, #1D5D9B 100%)', '--color': '#ffffff' }}>
          <IonTitle style={{ fontWeight: 700 }}>Spatial Monitoring Map</IonTitle>
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
        {/* Floating Top Search & Filter Bar */}
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            right: '12px',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          {/* Search Box */}
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
              placeholder="Search site, address, code, or grid cell..."
              showClearButton="always"
              style={{ '--background': 'transparent', '--box-shadow': 'none', padding: 0 }}
            />
          </div>

          {/* Horizontal Filter Chips */}
          <div
            style={{
              display: 'flex',
              gap: '6px',
              overflowX: 'auto',
              paddingBottom: '4px',
              scrollbarWidth: 'none',
            }}
          >
            <IonChip
              color={activeFilter === 'all' ? 'primary' : 'medium'}
              outline={activeFilter !== 'all'}
              onClick={() => setActiveFilter('all')}
              style={{ fontWeight: 600, fontSize: '12px', background: activeFilter === 'all' ? '#1D5D9B' : '#ffffff', color: activeFilter === 'all' ? '#ffffff' : '#475569' }}
            >
              All Markers
            </IonChip>
            <IonChip
              color={activeFilter === 'piggery' ? 'success' : 'medium'}
              outline={activeFilter !== 'piggery'}
              onClick={() => setActiveFilter('piggery')}
              style={{ fontWeight: 600, fontSize: '12px', background: activeFilter === 'piggery' ? '#10b981' : '#ffffff', color: activeFilter === 'piggery' ? '#ffffff' : '#475569' }}
            >
              Piggeries 🐷
            </IonChip>
            <IonChip
              color={activeFilter === 'ambient' ? 'tertiary' : 'medium'}
              outline={activeFilter !== 'ambient'}
              onClick={() => setActiveFilter('ambient')}
              style={{ fontWeight: 600, fontSize: '12px', background: activeFilter === 'ambient' ? '#3b82f6' : '#ffffff', color: activeFilter === 'ambient' ? '#ffffff' : '#475569' }}
            >
              Ambient Zones 🍃
            </IonChip>
            <IonChip
              color={activeFilter === 'warning' ? 'warning' : 'medium'}
              outline={activeFilter !== 'warning'}
              onClick={() => setActiveFilter('warning')}
              style={{ fontWeight: 600, fontSize: '12px', background: activeFilter === 'warning' ? '#eab308' : '#ffffff', color: activeFilter === 'warning' ? '#ffffff' : '#475569' }}
            >
              Warning (5-10 PPM) 🟡
            </IonChip>
            <IonChip
              color={activeFilter === 'critical' ? 'danger' : 'medium'}
              outline={activeFilter !== 'critical'}
              onClick={() => setActiveFilter('critical')}
              style={{ fontWeight: 600, fontSize: '12px', background: activeFilter === 'critical' ? '#ef4444' : '#ffffff', color: activeFilter === 'critical' ? '#ffffff' : '#475569' }}
            >
              Critical (&gt;20 PPM) 🔴
            </IonChip>
          </div>
        </div>

        {/* Map Canvas */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', background: '#F1F5F9' }}>
            <IonSpinner name="crescent" color="primary" />
            <p style={{ color: '#64748B', fontWeight: 600, marginTop: '12px' }}>Loading Manolo Fortich Map & Sensors...</p>
          </div>
        ) : (
          <FullMapView
            sites={filteredSites}
            readings={filteredReadings}
            showSitesLayer={showSitesLayer}
            showReadingsLayer={showReadingsLayer}
            showGridLayer={showGridLayer}
            showBoundaryLayer={showBoundaryLayer}
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
            onSelectGridCell={(cellId, cellReadings) => {
              closeBottomSheet();
              setSelectedGridCell({ id: cellId, readings: cellReadings });
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
          {/* Center Manolo Fortich */}
          <IonButton
            size="small"
            shape="round"
            onClick={handleCenterManoloFortich}
            style={{
              '--background': '#ffffff',
              '--color': '#0F3C5C',
              '--box-shadow': '0 4px 14px rgba(0,0,0,0.2)',
              width: '44px',
              height: '44px',
              fontWeight: 'bold',
            }}
          >
            🏛️
          </IonButton>

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
        {(selectedSite || selectedReading || selectedGridCell) && (
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
              animation: 'slideUp 0.3s ease-out',
            }}
          >
            {/* Drawer Header Handle & Close Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ width: '40px', height: '4px', background: '#cbd5e1', borderRadius: '2px', margin: '0 auto' }}></div>
              <IonButton fill="clear" size="small" onClick={closeBottomSheet} style={{ position: 'absolute', right: '12px', top: '12px', color: '#64748b' }}>
                <IonIcon icon={closeOutline} style={{ fontSize: '24px' }} />
              </IonButton>
            </div>

            {/* SITE DETAILS BOTTOM SHEET */}
            {selectedSite && (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <IonBadge style={{ background: getSiteTypeColor(selectedSite.site_type), color: '#ffffff', padding: '4px 8px', borderRadius: '6px' }}>
                    {selectedSite.site_type || 'Agricultural'}
                  </IonBadge>
                  <span style={{ fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace', fontWeight: 600 }}>
                    {selectedSite.site_code}
                  </span>
                </div>

                <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', fontWeight: 700, color: '#0f172a' }}>
                  {selectedSite.site_name}
                </h2>

                <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <IonIcon icon={locationOutline} style={{ color: '#1d5d9b' }} />
                  {selectedSite.address || 'Manolo Fortich, Bukidnon'}
                </p>

                {/* Photo Preview if available */}
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
                    <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Grid Cell ID</span>
                    <strong style={{ color: '#0f172a' }}>Cell {selectedSite.grid_cell_id || 'A1'}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Coordinates</span>
                    <strong style={{ color: '#0f172a' }}>{selectedSite.latitude.toFixed(4)}°, {selectedSite.longitude.toFixed(4)}°</strong>
                  </div>
                  <div>
                    <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Municipality</span>
                    <strong style={{ color: '#0f172a' }}>Manolo Fortich</strong>
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
                </div>
              </div>
            )}

            {/* SENSOR READING DETAILS BOTTOM SHEET */}
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
                    <span style={{ color: '#64748b', display: 'block', fontSize: '11px' }}>Grid Cell ID</span>
                    <strong style={{ color: '#0f172a' }}>{selectedReading.grid_cell_id || 'N/A'}</strong>
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
                    <IonIcon icon={eyeOutline} slot="start" /> View Photo & EXIF Metadata
                  </IonButton>
                )}
              </div>
            )}

            {/* GRID CELL SUMMARY BOTTOM SHEET */}
            {selectedGridCell && (
              <div>
                <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                  Spatial Grid Cell {selectedGridCell.id}
                </h3>
                <p style={{ margin: '0 0 14px 0', fontSize: '13px', color: '#64748b' }}>
                  {selectedGridCell.readings.length} sensor readings recorded within cell bounds.
                </p>

                {selectedGridCell.readings.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                    No sensor readings recorded in this grid cell yet.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedGridCell.readings.map((r) => (
                      <div
                        key={r.id}
                        onClick={() => setSelectedReading(r)}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '10px 14px',
                          background: '#f8fafc',
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0',
                          cursor: 'pointer',
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: '14px', color: getAmmoniaColor(r.ammonia) }}>
                            NH₃: {r.ammonia.toFixed(1)} PPM
                          </strong>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            Device: {r.device_uid} • {new Date(r.created_at).toLocaleTimeString()}
                          </div>
                        </div>
                        <IonIcon icon={chevronForwardOutline} style={{ color: '#94a3b8' }} />
                      </div>
                    ))}
                  </div>
                )}
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
              Map Layers & Overlays
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
                  checked={showGridLayer}
                  onChange={(e) => setShowGridLayer(e.target.checked)}
                />
                <b>Spatial Grid Overlay</b> (A1-F6)
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
              <h2 style={{ margin: 0, fontWeight: 'bold', color: '#0f172a' }}>Map Colors & Legend</h2>
              <IonButton fill="clear" onClick={() => setShowLegend(false)}>
                <IonIcon icon={closeOutline} />
              </IonButton>
            </div>

            <IonCard className="premium-card" style={{ margin: '0 0 16px 0', padding: '14px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontWeight: 700, color: '#0f172a' }}>
                Sensor Data Ammonia Thresholds (PPM)
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

            <IonCard className="premium-card" style={{ margin: '0 0 20px 0', padding: '14px' }}>
              <h4 style={{ margin: '0 0 10px 0', fontWeight: 700, color: '#0f172a' }}>
                Monitoring Site Pins by Type
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#10b981' }}></span>
                  <b>Piggery / Livestock Farm</b> (Green Pin)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#3b82f6' }}></span>
                  <b>Ambient / Agricultural Zone</b> (Blue Pin)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#f59e0b' }}></span>
                  <b>Industrial Facility</b> (Orange Pin)
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: '#8b5cf6' }}></span>
                  <b>Poultry Farm</b> (Purple Pin)
                </div>
              </div>
            </IonCard>

            <IonButton expand="block" className="btn-ammoni btn-primary" onClick={() => setShowLegend(false)}>
              Close Legend
            </IonButton>
          </div>
        </IonModal>

        {/* PHOTO & EXIF MODAL */}
        <IonModal isOpen={showPhotoModal} onDidDismiss={() => setShowPhotoModal(false)}>
          <div style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
            <h2 style={{ marginTop: 0, fontWeight: 'bold' }}>EXIF Inspection Photo</h2>
            {selectedReading?.photo_url && (
              <div style={{ width: '100%', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#0f172a', marginBottom: '16px' }}>
                <img src={selectedReading.photo_url} alt="Inspection Photo" style={{ width: '100%', maxHeight: '420px', objectFit: 'contain' }} />
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
          duration={3000}
          position="bottom"
        />
      </IonContent>
    </IonPage>
  );
}
