import {
  IonPage,
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardContent,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonButton,
  IonButtons,
  IonIcon,
  IonChip,
  IonLabel
} from '@ionic/react';

import { useNavigate } from 'react-router-dom';
import { refreshOutline, alertCircle, notificationsOutline } from 'ionicons/icons';
import { useUserDashboardData } from '../../hooks/useUserDashboardData';
import { AmmoniaTrendChart, DeviceStatusChart } from '../../components/charts';
import StatsCard from '../../components/charts/StatsCard';

export default function UserDashboard() {
  const navigate = useNavigate();
  const { stats, chartData, loading, refresh } = useUserDashboardData();

  const handleRefresh = async (event: CustomEvent) => {
    await refresh();
    event.detail.complete();
  };

  if (loading || !chartData) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonTitle>DASHBOARD</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <IonSpinner />
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>DASHBOARD</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={refresh}>
              <IonIcon icon={refreshOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <IonGrid>
          {/* Stats Cards */}
          <IonRow>
            <IonCol size="6" size-md="3">
              <StatsCard
                title="Piggeries"
                value={stats.piggeryCount}
                icon="business-outline"
                color="primary"
              />
            </IonCol>
            <IonCol size="6" size-md="3">
              <StatsCard
                title="Devices"
                value={stats.deviceCount}
                icon="hardware-chip-outline"
                color="secondary"
              />
            </IonCol>
            <IonCol size="6" size-md="3">
              <StatsCard
                title="Active Alerts"
                value={stats.alertCount}
                icon="alert-circle-outline"
                color={stats.alertCount > 0 ? 'danger' : 'success'}
                subtitle={stats.alertCount > 0 ? 'Action required!' : 'All clear'}
              />
            </IonCol>
            <IonCol size="6" size-md="3">
              <IonCard button onClick={() => navigate('/my-notifications')}>
                <IonCardContent style={{ textAlign: 'center' }}>
                  <IonIcon 
                    icon={notificationsOutline} 
                    style={{ 
                      fontSize: '32px', 
                      color: stats.notificationCount > 0 ? 'var(--ion-color-primary)' : 'var(--ion-color-medium)'
                    }} 
                  />
                  <h2 style={{ 
                    margin: '8px 0 4px 0', 
                    fontSize: '28px', 
                    fontWeight: 'bold',
                    color: stats.notificationCount > 0 ? 'var(--ion-color-primary)' : 'var(--ion-color-medium)'
                  }}>
                    {stats.notificationCount}
                  </h2>
                  <p style={{ margin: '0', fontSize: '14px', color: 'var(--ion-color-medium)' }}>
                    Notifications
                  </p>
                  {stats.notificationCount > 0 && (
                    <IonChip color="danger" style={{ marginTop: '4px' }}>
                      <IonLabel>New</IonLabel>
                    </IonChip>
                  )}
                </IonCardContent>
              </IonCard>
            </IonCol>
          </IonRow>

          {/* Ammonia Trend */}
          <IonRow>
            <IonCol size="12">
              <IonCard>
                <IonCardContent style={{ height: '250px' }}>
                  <AmmoniaTrendChart data={chartData.ammoniaTrend} />
                </IonCardContent>
              </IonCard>
            </IonCol>
          </IonRow>

          {/* Device Status */}
          <IonRow>
            <IonCol size="12" size-md="6">
              <IonCard>
                <IonCardContent style={{ height: '220px' }}>
                  <DeviceStatusChart data={chartData.deviceStatus} />
                </IonCardContent>
              </IonCard>
            </IonCol>
            <IonCol size="12" size-md="6">
              <IonCard>
                <IonCardContent style={{ padding: '16px' }}>
                  <h3 style={{ marginBottom: '12px', fontSize: '16px', fontWeight: 'bold' }}>Quick Summary</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--ion-color-light)' }}>
                      <span>Latest Ammonia</span>
                      <span style={{ fontWeight: 'bold', color: stats.latestAmmonia > 70 ? 'red' : stats.latestAmmonia > 40 ? 'orange' : 'green' }}>
                        {stats.latestAmmonia.toFixed(1)} ppm
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--ion-color-light)' }}>
                      <span>Average Ammonia</span>
                      <span style={{ fontWeight: 'bold' }}>{stats.averageAmmonia.toFixed(1)} ppm</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--ion-color-light)' }}>
                      <span>Active Devices</span>
                      <span style={{ fontWeight: 'bold', color: 'green' }}>{stats.activeDevices} / {stats.deviceCount}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                      <span>Unread Notifications</span>
                      <span style={{ fontWeight: 'bold', color: stats.notificationCount > 0 ? 'var(--ion-color-primary)' : 'gray' }}>
                        {stats.notificationCount}
                      </span>
                    </div>
                  </div>
                </IonCardContent>
              </IonCard>
            </IonCol>
          </IonRow>

          {/* Alert Notification */}
          {stats.alertCount > 0 && (
            <IonRow>
              <IonCol size="12">
                <IonCard color="danger" button onClick={() => navigate('/my-alerts')}>
                  <IonCardContent style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <IonIcon icon={alertCircle} size="large" />
                    <div>
                      <h3 style={{ margin: 0 }}>You have {stats.alertCount} unread alert{stats.alertCount > 1 ? 's' : ''}</h3>
                      <p style={{ fontSize: '14px', margin: '4px 0 0 0' }}>Tap to view</p>
                    </div>
                  </IonCardContent>
                </IonCard>
              </IonCol>
            </IonRow>
          )}
        </IonGrid>
      </IonContent>
    </IonPage>
  );
}