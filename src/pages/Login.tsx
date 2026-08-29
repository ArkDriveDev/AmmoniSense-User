import React, { useState, useEffect } from 'react';
import { 
  IonPage, 
  IonContent, 
  IonInput, 
  IonButton, 
  IonTitle, 
  IonText, 
  IonItem, 
  IonIcon, 
  IonToast, 
  IonSpinner, 
  IonGrid, 
  IonRow, 
  IonCol, 
  IonCard, 
  IonCardContent 
} from '@ionic/react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import offlineStorage from '../services/OfflineStorageService';
import { mailOutline, lockClosedOutline, leafOutline } from 'ionicons/icons';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Clear any stale/corrupt session on mount to prevent 400 race conditions on Android
  useEffect(() => {
    const clearStaleSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          const { error } = await supabase.auth.getUser();
          if (error) {
            await supabase.auth.signOut();
            offlineStorage.clearSession();
          }
        }
      } catch (e) {
        console.warn('Notice clearing stale auth session:', e);
      }
    };
    clearStaleSession();
  }, []);

  const login = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (loading) return;

    const trimmedEmail = email.trim();
    const trimmedPassword = password;

    if (!trimmedEmail || !trimmedPassword) {
      setToastMessage('Please enter email and password');
      setShowToast(true);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      });

      if (error) {
        setToastMessage('Login failed: ' + error.message);
        setShowToast(true);
        setLoading(false);
        return;
      }

      // Save persistent offline session
      if (data?.session) {
        offlineStorage.saveSession(data.session, {
          email: data.session.user?.email || trimmedEmail,
          id: data.session.user?.id,
        });
      }

      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      console.error('Login error:', err);
      setToastMessage(err?.message || 'An unexpected error occurred');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonContent 
        className="ion-padding" 
        style={{ 
          '--background': 'linear-gradient(135deg, #0F3C5C 0%, #1D5D9B 50%, #008B74 100%)',
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          minHeight: '100vh'
        }}
      >
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px'
        }}>
          <IonGrid style={{ maxWidth: '420px', width: '100%' }}>
            <IonRow>
              <IonCol>
                <IonCard className="premium-card" style={{ padding: '8px' }}>
                  <IonCardContent>
                    <div style={{ textAlign: 'center', marginBottom: '28px', marginTop: '12px' }}>
                      <div style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: '20px',
                        background: 'linear-gradient(135deg, #1D5D9B 0%, #008B74 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 16px auto',
                        boxShadow: '0 8px 24px rgba(29, 93, 155, 0.3)'
                      }}>
                        <IonIcon icon={leafOutline} style={{ fontSize: '32px', color: '#FFFFFF' }} />
                      </div>
                      <IonTitle style={{ fontSize: '26px', fontWeight: '800', color: '#0F172A', letterSpacing: '-0.02em' }}>
                        AmmoniSense
                      </IonTitle>
                      <IonText color="medium">
                        <p style={{ margin: '6px 0 0 0', fontSize: '14px', fontWeight: '500' }}>
                          Environmental Ammonia Monitoring
                        </p>
                      </IonText>
                    </div>

                    <form onSubmit={login}>
                      <IonItem className="premium-input-item" lines="none">
                        <IonIcon icon={mailOutline} slot="start" style={{ color: '#1D5D9B' }} />
                        <IonInput
                          type="email"
                          placeholder="Inspector Email"
                          value={email}
                          onIonInput={(e) => setEmail(e.detail.value || '')}
                          required
                        />
                      </IonItem>

                      <IonItem className="premium-input-item" lines="none" style={{ marginTop: '12px' }}>
                        <IonIcon icon={lockClosedOutline} slot="start" style={{ color: '#1D5D9B' }} />
                        <IonInput
                          type="password"
                          placeholder="Password"
                          value={password}
                          onIonInput={(e) => setPassword(e.detail.value || '')}
                          required
                        />
                      </IonItem>

                      <IonButton
                        type="submit"
                        className="btn-ammoni btn-primary"
                        expand="block"
                        disabled={loading}
                        style={{ marginTop: '24px' }}
                      >
                        {loading ? (
                          <>
                            <IonSpinner name="crescent" />
                            &nbsp;Logging in...
                          </>
                        ) : (
                          'Sign In to Dashboard'
                        )}
                      </IonButton>
                    </form>

                    <div style={{ textAlign: 'center', marginTop: '20px' }}>
                      <IonText color="medium">
                        <p style={{ fontSize: '14px' }}>
                          Don't have an inspector account?{' '}
                          <span 
                            style={{ color: '#1D5D9B', fontWeight: '700', cursor: 'pointer' }}
                            onClick={() => navigate('/register')}
                          >
                            Register
                          </span>
                        </p>
                      </IonText>
                    </div>
                  </IonCardContent>
                </IonCard>
              </IonCol>
            </IonRow>
          </IonGrid>
        </div>

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMessage}
          duration={5000}
          color="danger"
          position="bottom"
        />
      </IonContent>
    </IonPage>
  );
}