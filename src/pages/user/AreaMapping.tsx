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
  layersOutline,
  businessOutline,
  analyticsOutline
} from 'ionicons/icons';
import PolygonDrawer from '../../components/map/PolygonDrawer';
import { OdorZone } from '../../types/site';
import { supabase } from '../../services/supabase';
import {
  fetchOdorZones,
  saveOdorZone,
  fetchZoneReadingStats
} from '../../services/siteService';

interface SiteOption {
  id: number;
  site_name: string;
  site_code?: string;
  current_latitude?: number;
  current_longitude?: number;
}

export default function AreaMapping() {
  const [loading, setLoading] = useState<boolean>(true);
  const [odorZones, setOdorZones] = useState<OdorZone[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);

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
      const [zones, sitesRes, stats] = await Promise.all([
        fetchOdorZones(),
        supabase.from('monitoring_sites').select('id, site_name, site_code, current_latitude, current_longitude'),
        fetchZoneReadingStats(),
      ]);

      const sitesList: SiteOption[] = sitesRes.data || [];
      setSites(sitesList);

      // Merge stats map
      const statsMap = new Map<string | number, any>();
      (stats || []).forEach((st: any) => {
        if (st.zone_id || st.id) {
          statsMap.set(st.zone_id || st.id, st);
        }
      });

      const enrichedZones = (zones || []).map((z) => {
        const zoneStat = z.id ? statsMap.get(z.id) : null;
        return {
          ...z,
          reading_count: zoneStat?.reading_count ?? z.reading_count ?? 0,
          avg_ammonia: zoneStat?.avg_ammonia ?? z.avg_ammonia,
          max_ammonia: zoneStat?.max_ammonia ?? z.max_ammonia,
          min_ammonia: zoneStat?.min_ammonia ?? z.min_ammonia,
        };
      });

      setOdorZones(enrichedZones);
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

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar style={{ '--background': 'linear-gradient(135deg, #0F3C5C 0%, #1D5D9B 100%)', '--color': '#ffffff' }}>
          <IonTitle style={{ fontWeight: 700 }}>Odor Zone Area Mapping</IonTitle>
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
                <h3 style={{ margin: 0, fontWeight: 800, fontSize: '17px' }}>Site Odor Zone Mapping</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', opacity: 0.85 }}>
                  Draw ONE Odor Zone polygon per site. Sensor readings inside the boundary automatically correlate to the zone.
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Odor Zone Polygon Drawer */}
          <PolygonDrawer
            sites={sites}
            onSaveOdorZone={handleSaveOdorZone}
            height="440px"
          />

          {/* Saved Odor Zones Summary List */}
          <div style={{ marginTop: '24px' }}>
            <h4 style={{ fontWeight: 800, color: '#0F172A', fontSize: '16px', marginBottom: '12px' }}>
              Saved Odor Zones ({odorZones.length})
            </h4>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '30px' }}>
                <IonSpinner name="crescent" color="primary" />
                <p style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>Loading odor zones...</p>
              </div>
            ) : odorZones.length === 0 ? (
              <IonCard className="premium-card" style={{ margin: 0, padding: '20px', textAlign: 'center' }}>
                <IonCardContent>
                  <IonIcon icon={layersOutline} style={{ fontSize: '36px', color: '#94A3B8', marginBottom: '8px' }} />
                  <p style={{ margin: 0, color: '#64748B', fontWeight: 600, fontSize: '14px' }}>
                    No Odor Zones saved yet. Select a site and tap points on the map above to draw its impact boundary!
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
                              <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
                                <IonBadge style={{ background: '#F97316', color: '#ffffff', fontSize: '10px', fontWeight: 800 }}>
                                  🟧 ODOR ZONE
                                </IonBadge>
                                {z.site_name && (
                                  <IonBadge color="light" style={{ color: '#0F3C5C', fontSize: '10px', fontWeight: 700 }}>
                                    <IonIcon icon={businessOutline} style={{ marginRight: '3px', verticalAlign: 'middle' }} />
                                    {z.site_name}
                                  </IonBadge>
                                )}
                              </div>
                              <h4 style={{ margin: '2px 0 6px 0', fontWeight: 700, color: '#0F172A', fontSize: '15px' }}>{z.zone_name}</h4>
                              <div style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.6' }}>
                                {z.area_size_hectares ? <span>Area: <b>{z.area_size_hectares} ha</b> • </span> : null}
                                <span>Vertices: <b>{z.coordinates?.length || 0} pts</b></span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                  <IonIcon icon={analyticsOutline} style={{ color: '#1D5D9B' }} />
                                  <span>Readings: <b>{z.reading_count || 0}</b></span>
                                  {z.avg_ammonia !== undefined && z.avg_ammonia !== null && (
                                    <span>(Avg: <b>{Number(z.avg_ammonia).toFixed(1)} ppm</b>)</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            {z.is_pending_sync && (
                              <IonBadge color="warning" style={{ fontSize: '10px' }}>Pending Sync</IonBadge>
                            )}
                          </div>
                        </IonCardContent>
                      </IonCard>
                    </IonCol>
                  ))}
                </IonRow>
              </IonGrid>
            )}
          </div>
        </IonGrid>

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMsg}
          duration={3500}
          color={toastColor}
          position="bottom"
        />
      </IonContent>
    </IonPage>
  );
}
