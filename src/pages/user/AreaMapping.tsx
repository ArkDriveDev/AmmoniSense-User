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