import React, { useEffect, useState, useCallback } from 'react';
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
  IonRefresherContent,
  IonLabel,
} from '@ionic/react';
import {
  pricetagOutline,
  refreshOutline,
  businessOutline,
  analyticsOutline,
  locationOutline,
} from 'ionicons/icons';
import { supabase } from '../../services/supabase';
import { fetchTags } from '../../services/tagService';
import { InspectionTag, calculateAmmoniaStatus } from '../../types/inspection';

const STATUS_COLOR: Record<string, string> = {
  NORMAL: '#10B981',
  WARNING: '#F59E0B',
  HIGH: '#F97316',
  CRITICAL: '#EF4444',
};

export default function AreaMapping() {
  const [loading, setLoading] = useState(true);
  const [tags, setTags] = useState<InspectionTag[]>([]);
  const [sites, setSites] = useState<{ id: number; site_name: string }[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');

  const [toastMsg, setToastMsg] = useState('');
  const [showToast, setShowToast] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [tagList, sitesRes] = await Promise.all([
        fetchTags(selectedSiteId ? { siteId: selectedSiteId } : {}),
        supabase
          .from('inspection_sites')
          .select('id, site_name')
          .order('site_name'),
      ]);
      setTags(tagList);
      setSites(sitesRes.data || []);
    } catch (err: any) {
      console.error('[AreaMapping] load error:', err);
      setToastMsg('Failed to load tag data.');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  }, [selectedSiteId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRefresh = async (event: CustomEvent) => {
    await loadData();
    event.detail.complete();
  };

  const filteredTags = selectedSiteId
    ? tags.filter((t) => String(t.inspection_site_id) === selectedSiteId)
    : tags;

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar
          style={{ '--background': 'linear-gradient(135deg, #0F3C5C 0%, #1D5D9B 100%)', '--color': '#ffffff' }}
        >
          <IonTitle style={{ fontWeight: 700 }}>Inspection Tag Overview</IonTitle>
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
          {/* Header Banner */}
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(15, 60, 92, 0.95), rgba(29, 93, 155, 0.9))',
              borderRadius: '16px',
              padding: '16px',
              color: '#ffffff',
              marginBottom: '16px',
              boxShadow: '0 6px 20px rgba(15, 60, 92, 0.2)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <IonIcon icon={pricetagOutline} style={{ fontSize: '28px', color: '#60A5FA' }} />
              <div>
                <h3 style={{ margin: 0, fontWeight: 800, fontSize: '17px' }}>Inspection Tags</h3>
                <p style={{ margin: '2px 0 0 0', fontSize: '12px', opacity: 0.85 }}>
                  Point readings captured during site inspections — ammonia, temperature, humidity, and GPS location.
                </p>
              </div>
            </div>
          </div>

          {/* Site Filter */}
          <IonCard className="premium-card" style={{ margin: '0 0 16px 0' }}>
            <IonCardContent style={{ padding: '12px' }}>
              <IonLabel style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', textTransform: 'uppercase' }}>
                Filter by Site
              </IonLabel>
              <select
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
                style={{
                  width: '100%',
                  marginTop: '6px',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1.5px solid #CBD5E1',
                  fontSize: '14px',
                  fontWeight: 600,
                  color: '#0F172A',
                  background: '#FFFFFF',
                }}
              >
                <option value="">All Sites ({tags.length} tags)</option>
                {sites.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.site_name}
                  </option>
                ))}
              </select>
            </IonCardContent>
          </IonCard>

          {/* Tag List */}
          <div>
            <h4 style={{ fontWeight: 800, color: '#0F172A', fontSize: '16px', marginBottom: '12px' }}>
              Inspection Tags ({filteredTags.length})
            </h4>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '30px' }}>
                <IonSpinner name="crescent" color="primary" />
                <p style={{ fontSize: '13px', color: '#64748B', fontWeight: 600 }}>Loading tags...</p>
              </div>
            ) : filteredTags.length === 0 ? (
              <IonCard className="premium-card" style={{ margin: 0, padding: '20px', textAlign: 'center' }}>
                <IonCardContent>
                  <IonIcon icon={pricetagOutline} style={{ fontSize: '36px', color: '#94A3B8', marginBottom: '8px' }} />
                  <p style={{ margin: 0, color: '#64748B', fontWeight: 600, fontSize: '14px' }}>
                    No inspection tags yet. Complete an inspection schedule to capture readings.
                  </p>
                </IonCardContent>
              </IonCard>
            ) : (
              <IonGrid style={{ padding: 0 }}>
                <IonRow>
                  {filteredTags.map((tag, idx) => {
                    const statusColor = STATUS_COLOR[tag.status] || '#94A3B8';
                    return (
                      <IonCol key={tag.id || idx} size="12" size-md="6">
                        <IonCard className="premium-card" style={{ margin: '0 0 12px 0' }}>
                          <IonCardContent style={{ padding: '14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
                                  <IonBadge style={{ background: statusColor, color: '#ffffff', fontSize: '10px', fontWeight: 800 }}>
                                    {tag.status}
                                  </IonBadge>
                                  {tag.isOffline && (
                                    <IonBadge color="warning" style={{ fontSize: '10px' }}>Pending Sync</IonBadge>
                                  )}
                                </div>
                                <h4 style={{ margin: '2px 0 6px 0', fontWeight: 700, color: '#0F172A', fontSize: '15px' }}>
                                  {tag.tag_name}
                                </h4>
                                <div style={{ fontSize: '12px', color: '#64748B', lineHeight: '1.7' }}>
                                  <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                    <span>
                                      <IonIcon icon={analyticsOutline} style={{ verticalAlign: 'middle', marginRight: '3px', color: statusColor }} />
                                      NH₃: <b style={{ color: statusColor }}>{tag.ammonia} ppm</b>
                                    </span>
                                    <span>🌡️ {tag.temperature}°C</span>
                                    <span>💧 {tag.humidity}%</span>
                                    <span>🔋 {tag.battery}%</span>
                                  </div>
                                  {(tag.latitude && tag.longitude) ? (
                                    <div style={{ marginTop: '4px' }}>
                                      <IonIcon icon={locationOutline} style={{ verticalAlign: 'middle', marginRight: '3px', color: '#1D5D9B' }} />
                                      {Number(tag.latitude).toFixed(5)}, {Number(tag.longitude).toFixed(5)}
                                    </div>
                                  ) : null}
                                  {tag.notes && (
                                    <div style={{ marginTop: '4px', fontStyle: 'italic' }}>{tag.notes}</div>
                                  )}
                                </div>
                              </div>
                              {tag.photo_url && (
                                <img
                                  src={tag.photo_thumbnail_url || tag.photo_url}
                                  alt="tag"
                                  style={{ width: '56px', height: '56px', borderRadius: '8px', objectFit: 'cover', marginLeft: '10px', flexShrink: 0 }}
                                />
                              )}
                            </div>
                            {tag.created_at && (
                              <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#94A3B8' }}>
                                {new Date(tag.created_at).toLocaleString()}
                              </p>
                            )}
                          </IonCardContent>
                        </IonCard>
                      </IonCol>
                    );
                  })}
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
          color="danger"
          position="bottom"
        />
      </IonContent>
    </IonPage>
  );
}
