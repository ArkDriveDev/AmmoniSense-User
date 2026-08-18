import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';

export function useUserDashboardData() {
  const [stats, setStats] = useState({
    siteCount: 0,
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

      const { data: owners } = await supabase
        .from('site_owners')
        .select('id')
        .eq('created_by', userId);

      const ownerId = owners && owners.length > 0 ? owners[0].id : null;

      let sites: any[] = [];
      if (ownerId) {
        const { data: sitesData } = await supabase
          .from('monitoring_sites')
          .select('id, site_name, address, site_code')
          .eq('owner_id', ownerId);

        if (sitesData) {
          sites = sitesData.map(s => ({
            id: s.id,
            site_name: s.site_name,
            location: s.address,
            site_code: s.site_code
          }));
        }
      }

      const siteIds = sites.map(s => s.id);

      let deviceQuery = supabase.from('devices').select('*');
      if (siteIds.length > 0) {
        deviceQuery = deviceQuery.in('site_id', siteIds);
      }

      const { data: devices } = await deviceQuery;

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
      } else {
        const { data } = await supabase
          .from('sensor_data')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(10);
        sensorData = data || [];
      }

      const activeDevices = devices?.filter(d => d.status === 'ACTIVE') || [];
      const avgAmmonia = sensorData.reduce((sum, d) => sum + (d.ammonia || 0), 0) / (sensorData.length || 1);

      setStats({
        siteCount: sites?.length || 0,
        deviceCount: devices?.length || 0,
        activeDevices: activeDevices.length,
        alertCount: 0,
        notificationCount: 0,
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