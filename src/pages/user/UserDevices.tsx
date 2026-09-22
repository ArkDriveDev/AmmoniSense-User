import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonBadge,
  IonButton,
  IonButtons,
  IonIcon,
  IonCard,
  IonCardContent
} from '@ionic/react';

import { useEffect, useState } from 'react';
import { fetchMyDevices } from '../../services/deviceService';
import type { DeviceRecord } from '../../services/deviceService';
import { refreshOutline, hardwareChipOutline, wifiOutline, timeOutline, linkOutline } from 'ionicons/icons';
import { useLocation } from 'react-router-dom';

export default function UserDevices() {
  const location = useLocation();
  const [devices, setDevices] = useState<DeviceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDevices();
  }, [location]);

  const loadDevices = async () => {
    setLoading(true);
    try {
      const data = await fetchMyDevices();
      setDevices(data);
    } catch (err) {
      console.error('Unexpected error fetching devices:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async (event: CustomEvent) => {
    await loadDevices();
    event.detail.complete();
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar style={{ '--background': 'linear-gradient(135deg, #0F3C5C 0%, #1D5D9B 100%)', '--color': '#ffffff' }}>
          <IonTitle style={{ fontWeight: 700 }}>My BLE Devices</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => loadDevices()} style={{ color: '#ffffff' }}>
              <IonIcon icon={refreshOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" style={{ '--background': '#F1F5F9' }}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        {loading ? (
          <div style={{ textAlign: 'center', marginTop: '60px' }}>
            <IonSpinner name="crescent" color="primary" />
            <p style={{ color: '#64748B', fontWeight: 600, marginTop: '12px' }}>Loading registered devices...</p>
          </div>
        ) : devices.length === 0 ? (
          <div style={{ textAlign: 'center', marginTop: '60px' }}>
            <IonCard className="premium-card" style={{ maxWidth: '440px', margin: '0 auto', padding: '24px' }}>
              <IonCardContent>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '16px',
                  background: 'rgba(29, 93, 155, 0.1)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px'
                }}>
                  <IonIcon icon={hardwareChipOutline} style={{ fontSize: '32px', color: '#1D5D9B' }} />
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: '0 0 8px 0' }}>No Devices Found</h3>
                <p style={{ fontSize: '14px', color: '#64748B', margin: 0 }}>
                  Connect your first BLE sensor and it will auto-register here instantly.
                </p>
              </IonCardContent>
            </IonCard>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {devices.map((d) => {
              const isRecentlySeen = d.last_seen_at && (new Date().getTime() - new Date(d.last_seen_at).getTime() < 120000);
              const isUnlinked = d.inspection_site_id === null || d.inspection_site_id === undefined;
              return (
                <IonCard key={d.id} className="premium-card" style={{ margin: 0 }}>
                  <IonCardContent style={{ padding: '18px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                          <div style={{
                            width: '38px',
                            height: '38px',
                            borderRadius: '12px',
                            background: isRecentlySeen ? 'rgba(5, 150, 105, 0.12)' : 'rgba(100, 116, 139, 0.12)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            <IonIcon icon={hardwareChipOutline} style={{ color: isRecentlySeen ? '#059669' : '#64748B', fontSize: '20px' }} />
                          </div>
                          <div>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0F172A', fontFamily: 'monospace' }}>
                              {d.device_name || d.device_uid}
                            </h3>
                            <span style={{ fontSize: '11px', color: '#94A3B8', fontFamily: 'monospace' }}>
                              UID: {d.device_uid}
                            </span>
                          </div>
                        </div>

                        <div style={{ fontSize: '12px', color: '#64748B', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px' }}>
                          <IonIcon icon={timeOutline} style={{ color: '#94A3B8' }} />
                          First seen: {d.first_seen_at ? new Date(d.first_seen_at).toLocaleDateString() : 'Unknown'}
                          {d.last_seen_at && (
                            <span style={{ color: '#475569' }}>
                              • Last seen: {new Date(d.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                        <IonBadge style={{ background: '#E2E8F0', color: '#475569', fontSize: '10px', fontWeight: 700 }}>
                          {d.status || 'ACTIVE'}
                        </IonBadge>
                        {isUnlinked ? (
                          <IonBadge style={{ background: '#fef9c3', color: '#92400e', fontSize: '10px', fontWeight: 700, borderRadius: '6px' }}>
                            <IonIcon icon={linkOutline} style={{ verticalAlign: 'middle', marginRight: '3px' }} />
                            Not linked to site
                          </IonBadge>
                        ) : (
                          <IonBadge style={{ background: '#ecfdf5', color: '#047857', fontSize: '10px', fontWeight: 700, borderRadius: '6px' }}>
                            Linked to site
                          </IonBadge>
                        )}
                      </div>
                    </div>
                  </IonCardContent>
                </IonCard>
              );
            })}
          </div>
        )}
      </IonContent>
    </IonPage>
  );
}