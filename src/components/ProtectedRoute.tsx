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

    init();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session?.user) {
          setUser(session.user);
          offlineStorage.saveSession(session);
        }
      }
    );

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        minHeight: '100vh'
      }}>
        <div style={{ color: '#666' }}>Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}