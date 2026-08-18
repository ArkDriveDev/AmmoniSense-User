import React, { useEffect, useState } from 'react';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardContent,
  IonGrid,
  IonRow,
  IonCol,
  IonBadge,
  IonButton,
  IonIcon,
  IonSpinner,
  IonToast,
  IonRefresher,
  IonRefresherContent
} from '@ionic/react';
import {
  shapesOutline,
  refreshOutline,
  checkmarkCircleOutline,
  warningOutline,
  trashOutline,
  layersOutline
} from 'ionicons/icons';
import PolygonDrawer from '../../components/map/PolygonDrawer';
import { OdorZone, CommunityPolygon } from '../../types/site';
import {
  fetchOdorZones,
  saveOdorZone,
  fetchCommunityPolygons,
  saveCommunityPolygon
} from '../../services/siteService';

export default function AreaMapping() {
  const [loading, setLoading] = useState<boolean>(true);
  const [odorZones, setOdorZones] = useState<OdorZone[]>([]);
  const [communityPolygons, setCommunityPolygons] = useState<CommunityPolygon[]>([]);

  // Toast State
  const [toastMsg, setToastMsg] = useState<string>('');
  const [showToast, setShowToast] = useState<boolean>(false);
  const [toastColor, setToastColor] = useState<string>('success');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [zones, comms] = await Promise.all([
        fetchOdorZones(),
        fetchCommunityPolygons(),
      ]);
      setOdorZones(zones);
      setCommunityPolygons(comms);
    } catch (err: any) {
      console.error('Error loading spatial polygon data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async (event: CustomEvent) => {
    await loadData();
    event.detail.complete();
  };

  const handleSaveOdorZone = async (zone: OdorZone) => {
    try {
      const saved = await saveOdorZone(zone);
      setOdorZones((prev) => [saved, ...prev]);
      setToastMsg(`🟧 Odor Zone "${zone.zone_name}" saved successfully!`);
      setToastColor('success');
      setShowToast(true);
    } catch (err: any) {
      console.warn('Error saving odor zone, saving locally:', err);
      const localZone = { ...zone, id: `local_${Date.now()}`, is_pending_sync: true };
      setOdorZones((prev) => [localZone, ...prev]);
      setToastMsg(`📶 Saved Odor Zone locally for auto-sync.`);
      setToastColor('warning');
      setShowToast(true);
    }
  };

  const handleSaveCommunity = async (comm: CommunityPolygon) => {
    try {
      const saved = await saveCommunityPolygon(comm);
      setCommunityPolygons((prev) => [saved, ...prev]);
      setToastMsg(`🟩 Community Polygon "${comm.community_name}" saved successfully!`);
      setToastColor('success');
      setShowToast(true);
    } catch (err: any) {
      console.warn('Error saving community polygon, saving locally:', err);
      const localComm = { ...comm, id: `local_${Date.now()}`, is_pending_sync: true };
      setCommunityPolygons((prev) => [localComm, ...prev]);
      setToastMsg(`📶 Saved Community Polygon locally for auto-sync.`);
      setToastColor('warning');
      setShowToast(true);
    }
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar style={{ '--background': 'linear-gradient(135deg, #0F3C5C 0%, #1D5D9B 100%)', '--color': '#ffffff' }}>
          <IonTitle style={{ fontWeight: 700 }}>Spatial Polygon & Area Mapping</IonTitle>
          <IonButton slot="end" fill="clear" onClick={loadData} style={{ color: '#ffffff' }}>
            <IonIcon icon={refreshOutline} />
          </IonButton>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" style={{ '--background': '#F1F5F9' }}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <IonGrid style={{ maxWidth: '850px', margin: '0 auto', padding: 0 }}>
          {/* Top Info Banner */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(15, 60, 92, 0.95), rgba(29, 93, 155, 0.9))',
              borderRadius: '16px',
              padding: '16px',
              color: '#ffffff',
              marginBottom: '16px',
              boxShadow: '0 6px 20px rgba(15, 60, 92, 0.2)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <IonIcon icon={shapesOutline} style={{ fontSize: '28px', color: '#60A5FA' }} />
              <div>
                <h3 style={{ margin: 0, fontWeight: 800, fontSize: '17px' }}>Polygon Area Mapping</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', opacity: 0.85 }}>
                  Draw spatial boundaries for Odor Plume Dispersion Zones and Vulnerable Communities. No grid cells required.
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Polygon Drawer */}
          <PolygonDrawer
            onSaveOdorZone={handleSaveOdorZone}
            onSaveCommunity={handleSaveCommunity}
            height="440px"
          />

          {/* Saved Spatial Polygons Summary List */}
          <div style={{ marginTop: '24px' }}>
            <h4 style={{ fontWeight: 800, color: '#0F172A', fontSize: '16px', marginBottom: '12px' }}>
              Saved Spatial Polygons ({odorZones.length + communityPolygons.length})
            </h4>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '30px' }}>
                <IonSpinner name="crescent" color="primary" />
                <p style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>Loading spatial polygons...</p>
              </div>
            ) : odorZones.length === 0 && communityPolygons.length === 0 ? (
              <IonCard className="premium-card" style={{ margin: 0, padding: '20px', textAlign: 'center' }}>
                <IonCardContent>
                  <IonIcon icon={layersOutline} style={{ fontSize: '36px', color: '#94A3B8', marginBottom: '8px' }} />
                  <p style={{ margin: 0, color: '#64748B', fontWeight: 600, fontSize: '14px' }}>
                    No spatial polygons saved yet. Tap points on the map above to draw Odor Zones or Community boundaries!
                  </p>
                </IonCardContent>
              </IonCard>
            ) : (
              <IonGrid style={{ padding: 0 }}>
                <IonRow>
                  {odorZones.map((z, idx) => (
                    <IonCol key={z.id || idx} size="12" size-md="6">
                      <IonCard className="premium-card" style={{ margin: '0 0 12px 0' }}>
                        <IonCardContent style={{ padding: '14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div>
                              <IonBadge style={{ background: z.severity_level === 'CRITICAL' ? '#EF4444' : '#F97316', fontSize: '10px', fontWeight: 800, marginBottom: '6px' }}>
                                🟧 ODOR ZONE ({z.severity_level})
                              </IonBadge>
                              <h4 style={{ margin: '2px 0 4px 0', fontWeight: 700, color: '#0F172A', fontSize: '15px' }}>{z.zone_name}</h4>
                              <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>
                                Ammonia NH₃: <b>{z.ammonia_ppm || 0} ppm</b> • Vertices: {z.coordinates?.length || 0} points
                              </p>
                            </div>
                            {z.is_pending_sync && (
                              <IonBadge color="warning" style={{ fontSize: '10px' }}>Pending Sync</IonBadge>
                            )}
                          </div>
                        </IonCardContent>
                      </IonCard>
                    </IonCol>
                  ))}

                  {communityPolygons.map((c, idx) => (