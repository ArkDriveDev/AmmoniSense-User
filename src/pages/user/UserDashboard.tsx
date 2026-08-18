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