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