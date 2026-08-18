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
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '10px',
                        background: 'rgba(29, 93, 155, 0.1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <IonIcon icon={analyticsOutline} style={{ color: '#1D5D9B', fontSize: '20px' }} />
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>Ammonia Concentration Trend</h3>
                        <p style={{ margin: 0, fontSize: '12px', color: '#64748B' }}>Real-time telemetry trendline (ppm)</p>
                      </div>
                    </div>
                  </div>
                  <div style={{ height: '240px' }}>
                    <AmmoniaTrendChart data={chartData.ammoniaTrend} />
                  </div>
                </IonCardContent>
              </IonCard>
            </IonCol>
          </IonRow>

          {/* Device Status & Quick Summary Row */}
          <IonRow>
            <IonCol size="12" size-md="6">
              <IonCard className="premium-card">
                <IonCardContent style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                    <IonIcon icon={pulseOutline} style={{ color: '#008B74', fontSize: '20px' }} />
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>Device Health Breakdown</h3>
                  </div>
                  <div style={{ height: '200px' }}>
                    <DeviceStatusChart data={chartData.deviceStatus} />
                  </div>
                </IonCardContent>
              </IonCard>
            </IonCol>

            <IonCol size="12" size-md="6">
              <IonCard className="premium-card premium-card-accent">
                <IonCardContent style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <IonIcon icon={checkmarkDoneCircleOutline} style={{ color: '#1D5D9B', fontSize: '22px' }} />
                    <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>Regulatory Telemetry Overview</h3>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px 14px',
                      background: 'rgba(248, 250, 252, 0.8)',
                      borderRadius: '12px',
                      border: '1px solid #E2E8F0'
                    }}>
                      <span style={{ fontSize: '14px', color: '#475569', fontWeight: 500 }}>Latest Ammonia Level</span>
                      <span className={`status-badge ${stats.latestAmmonia > 50 ? 'danger' : stats.latestAmmonia > 25 ? 'warning' : 'safe'}`}>
                        <span className="pulse-dot"></span>
                        {stats.latestAmmonia.toFixed(1)} ppm
                      </span>
                    </div>

                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',