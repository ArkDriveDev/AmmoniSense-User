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
  IonIcon
} from '@ionic/react';

import { refreshOutline } from 'ionicons/icons';
import { useUserDashboardData } from '../../hooks/useUserDashboardData';
import { AmmoniaTrendChart, DeviceStatusChart } from '../../components/charts';
import StatsCard from '../../components/charts/StatsCard';

export default function UserDashboard() {
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
            <IonCol size="6" size-md="4">
              <StatsCard
                title="Monitoring Sites"
                value={stats.siteCount}
                icon="business-outline"
                color="primary"
              />
            </IonCol>
            <IonCol size="6" size-md="4">
              <StatsCard
                title="Devices"
                value={stats.deviceCount}
                icon="hardware-chip-outline"
                color="secondary"
              />
            </IonCol>
            <IonCol size="12" size-md="4">
              <StatsCard
                title="Active Devices"
                value={stats.activeDevices}
                icon="hardware-chip-outline"
                color="success"
                subtitle={`Of ${stats.deviceCount} total devices`}
              />
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

          {/* Device Status & Summary */}
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                      <span>Active Devices</span>
                      <span style={{ fontWeight: 'bold', color: 'green' }}>{stats.activeDevices} / {stats.deviceCount}</span>
                    </div>
                  </div>
                </IonCardContent>
              </IonCard>
            </IonCol>
          </IonRow>
        </IonGrid>
      </IonContent>
    </IonPage>
  );
}