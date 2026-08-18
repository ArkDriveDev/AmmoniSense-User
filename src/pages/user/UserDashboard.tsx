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

import { refreshOutline, analyticsOutline, pulseOutline, checkmarkDoneCircleOutline } from 'ionicons/icons';
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
        <IonHeader className="ion-no-border">
          <IonToolbar style={{ '--background': '#0F3C5C', '--color': '#ffffff' }}>
            <IonTitle style={{ fontWeight: 700 }}>DASHBOARD</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', marginTop: '60px' }}>
            <IonSpinner name="crescent" color="primary" />
            <p style={{ marginTop: '12px', color: '#64748B', fontWeight: 600 }}>Loading Dashboard Data...</p>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar style={{ '--background': 'linear-gradient(135deg, #0F3C5C 0%, #1D5D9B 100%)', '--color': '#ffffff' }}>
          <IonTitle style={{ fontWeight: 700, letterSpacing: '0.02em' }}>AMMONISENSE DASHBOARD</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={refresh} style={{ color: '#ffffff' }}>
              <IonIcon icon={refreshOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding" style={{ '--background': '#F1F5F9' }}>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>

        <IonGrid>
          {/* Stats Cards Section */}
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
                title="Active Telemetry"
                value={stats.activeDevices}
                icon="hardware-chip-outline"
                color="success"
                subtitle={`Of ${stats.deviceCount} total devices online`}
              />
            </IonCol>
          </IonRow>

          {/* Ammonia Trend Chart Card */}
          <IonRow>
            <IonCol size="12">
              <IonCard className="premium-card">
                <IonCardContent style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>