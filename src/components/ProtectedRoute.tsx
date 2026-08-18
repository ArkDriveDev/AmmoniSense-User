import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import offlineStorage from '../services/OfflineStorageService';

export default function ProtectedRoute({ children }: any) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        let currentUser = data.session?.user ?? null;

        if (!currentUser) {
          // Check cached session in localStorage for offline access
          const cached = offlineStorage.getSession();
          if (cached?.session?.user || cached?.profile) {
            currentUser = cached.session?.user || { id: cached.profile?.id, email: cached.profile?.email };
          }
        }

        setUser(currentUser);
      } catch (err) {
        console.error('Auth error, attempting offline session fallback:', err);
        const cached = offlineStorage.getSession();
        if (cached?.session?.user || cached?.profile) {
          setUser(cached.session?.user || { id: cached.profile?.id, email: cached.profile?.email });
        }
      } finally {
        setLoading(false);
      }
    };
