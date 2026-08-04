import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

export function useUserDashboardData() {
  const [stats, setStats] = useState({
    piggeryCount: 0,
    deviceCount: 0,
    activeDevices: 0,
    alertCount: 0,
    notificationCount: 0,
    latestAmmonia: 0,
    averageAmmonia: 0
  });
  const [chartData, setChartData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      if (!userId) {
        setLoading(false);
        return;
      }

      let clientId: any = null;
      const { data: clientsData, error: clientErr } = await supabase
        .from('clients')
        .select('id')
        .eq('profile_id', userId);

      if (!clientErr && clientsData && clientsData.length > 0) {
        clientId = clientsData[0].id;
      } else {
        const { data: ownerData } = await supabase
          .from('livestock_owners')
          .select('id')
          .eq('created_by', userId);
        if (ownerData && ownerData.length > 0) {
          clientId = ownerData[0].id;
        }
      }

      if (!clientId) {
        setLoading(false);
        return;
      }

      let piggeries: any[] = [];
      const { data: piggeryData } = await supabase
        .from('piggeries')
        .select('id, piggery_name, location, piggery_serial')
        .eq('client_id', clientId);

      if (piggeryData && piggeryData.length > 0) {
        piggeries = piggeryData;
      } else {
        const { data: livestockData } = await supabase
          .from('livestock')
          .select('id, livestock_name, address, livestock_serial')
          .eq('owner_id', clientId);
        if (livestockData) {
          piggeries = livestockData.map(l => ({
            id: l.id,
            piggery_name: l.livestock_name,
            location: l.address,
            piggery_serial: l.livestock_serial
          }));
        }
      }

      const piggeryIds = piggeries?.map(p => p.id) || [];

      const { data: devices } = await supabase
        .from('devices')
        .select('*')
        .in('piggery_id', piggeryIds);

      const deviceUids = devices?.map(d => d.device_uid) || [];
      let sensorData: any[] = [];
      if (deviceUids.length > 0) {
        const { data } = await supabase
          .from('sensor_data')
          .select('*')
          .in('device_uid', deviceUids)
          .order('created_at', { ascending: false })
          .limit(10);
        sensorData = data || [];
      }

      let alertCount = 0;
      if (piggeryIds.length > 0) {
        const { count } = await supabase
          .from('alerts')
          .select('id', { count: 'exact', head: true })
          .in('piggery_id', piggeryIds)
          .eq('is_read', false);
        alertCount = count || 0;
      }

      const { count: notificationCount } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', userId)
        .eq('is_read', false);

      const activeDevices = devices?.filter(d => d.status === 'ACTIVE') || [];
      const avgAmmonia = sensorData.reduce((sum, d) => sum + (d.ammonia || 0), 0) / (sensorData.length || 1);

      setStats({
        piggeryCount: piggeries?.length || 0,
        deviceCount: devices?.length || 0,
        activeDevices: activeDevices.length,
        alertCount: alertCount,
        notificationCount: notificationCount || 0,
        latestAmmonia: sensorData[0]?.ammonia || 0,
        averageAmmonia: avgAmmonia || 0
      });

      const processedData = processChartData(sensorData, devices || []);
      setChartData(processedData);

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const processChartData = (sensorData: any[], devices: any[]) => {
    const grouped: Record<string, number[]> = {};
    sensorData.forEach((item) => {
      const date = new Date(item.created_at).toLocaleDateString();
      if (!grouped[date]) grouped[date] = [];
      grouped[date].push(item.ammonia || 0);
    });

    const labels = Object.keys(grouped).slice(-7);
    const values = labels.map((key) => {
      const avg = grouped[key].reduce((a, b) => a + b, 0) / grouped[key].length;
      return Math.round(avg);
    });

    const active = devices.filter(d => d.status === 'ACTIVE').length;
    const inactive = devices.filter(d => d.status === 'INACTIVE').length;
    const pending = devices.filter(d => d.status === 'PENDING' || !d.status).length;

    return {
      ammoniaTrend: {
        labels: labels.length > 0 ? labels : ['No Data'],
        datasets: [{
          label: 'Ammonia (ppm)',
          data: values.length > 0 ? values : [0],
          borderColor: '#3880ff',
          backgroundColor: 'rgba(56, 128, 255, 0.2)',
          fill: true,
          tension: 0.4,
        }],
      },
      deviceStatus: {
        labels: ['ACTIVE', 'INACTIVE', 'PENDING'],
        datasets: [{
          data: [active, inactive, pending],
          backgroundColor: ['#2dd36f', '#eb445a', '#ffc409'],
          borderColor: ['#2dd36f', '#eb445a', '#ffc409'],
          borderWidth: 1,
        }],
      },
    };
  };

  return { stats, chartData, loading, refresh: fetchDashboardData };
}