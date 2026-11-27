import React, { useState, useEffect } from 'react';
import { 
  IonPage, 
  IonContent, 
  IonInput, 
  IonButton, 
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
import nativePermissionsService from '../services/nativePermissionsService';
import { verifyAndRegisterDevice, DeviceApprovalState } from '../services/deviceApprovalService';
import DeviceApprovalCard from '../components/auth/DeviceApprovalCard';
import { mailOutline, lockClosedOutline, leafOutline } from 'ionicons/icons';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastColor, setToastColor] = useState<'success' | 'danger'>('danger');
  const [approvalStatus, setApprovalStatus] = useState<Exclude<DeviceApprovalState, 'APPROVED'> | null>(null);
  const [deviceIdentifier, setDeviceIdentifier] = useState('');

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
      setToastColor('danger');
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
        setToastColor('danger');
        setToastMessage('Login failed: ' + error.message);
        setShowToast(true);
        setLoading(false);
        return;
      }

      const profileId = data?.session?.user?.id || data?.user?.id;
      if (profileId) {
        const deviceCheck = await verifyAndRegisterDevice(profileId);
        if (deviceCheck.status !== 'APPROVED') {
          await supabase.auth.signOut();
          offlineStorage.clearSession();
          setDeviceIdentifier(deviceCheck.deviceIdentifier);
          setApprovalStatus(deviceCheck.status);
          setToastColor('danger');
          setToastMessage(deviceCheck.status === 'BLOCKED' ? 'Device Blocked.' : 'Waiting for Admin Approval.');
          setShowToast(true);
          return;
        }
      }

      // Save persistent offline session
      if (data?.session) {
        offlineStorage.saveSession(data.session, {
          email: data.session.user?.email || trimmedEmail,
          id: data.session.user?.id,
        });
      }

      // Proactively request native permissions (Location, Camera, BLE, Notifications)
      nativePermissionsService.requestAllPermissions().catch((pErr) => {
        console.warn('Post-login permissions notice:', pErr);
      });

      setToastColor('success');
      setToastMessage('Login successful! Welcome back.');
      setShowToast(true);

      setTimeout(() => {
        navigate('/dashboard', { replace: true });
      }, 800);
    } catch (err: any) {
      console.error('Login error:', err);
      setToastColor('danger');
      setToastMessage(err?.message || 'An unexpected error occurred');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonContent 
        style={{ 
          '--background': 'linear-gradient(135deg, #0F3C5C 0%, #1D5D9B 50%, #008B74 100%)',
        }}
      >
        <div style={{
          minHeight: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'calc(16px + env(safe-area-inset-top, 0px)) 12px calc(80px + env(safe-area-inset-bottom, 0px)) 12px',
          boxSizing: 'border-box',
        }}>
          <IonGrid style={{ maxWidth: '420px', width: '100%', padding: 0, margin: '0 auto' }}>
            <IonRow>
              <IonCol style={{ padding: 0 }}>
                {approvalStatus ? (
                  <DeviceApprovalCard
                    status={approvalStatus}
                    deviceIdentifier={deviceIdentifier}
                    onLogout={async () => {
                      await supabase.auth.signOut().catch(() => {});
                      offlineStorage.clearSession();
                      setApprovalStatus(null);
                      setPassword('');
                    }}
                  />
                ) : (
                <IonCard className="premium-card" style={{ margin: 0, width: '100%', padding: '4px' }}>
                  <IonCardContent style={{ padding: 'clamp(16px, 5vw, 24px)' }}>
                    <div style={{ textAlign: 'center', marginBottom: '24px', marginTop: '4px' }}>
                      <div style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '18px',
                        background: 'linear-gradient(135deg, #1D5D9B 0%, #008B74 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 14px auto',
                        boxShadow: '0 8px 24px rgba(29, 93, 155, 0.3)'
                      }}>
                        <IonIcon icon={leafOutline} style={{ fontSize: '30px', color: '#FFFFFF' }} />
                      </div>
                      <h1 style={{ margin: 0, fontSize: 'clamp(1.35rem, 6vw, 1.65rem)', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.02em', lineHeight: 1.2, whiteSpace: 'normal', overflowWrap: 'break-word' }}>
                        AmmoniSense
                      </h1>
                      <IonText color="medium">
                        <p style={{ margin: '6px 0 0 0', fontSize: 'clamp(12.5px, 3.5vw, 14px)', fontWeight: 500, lineHeight: 1.35 }}>
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
                  </IonCardContent>
                </IonCard>
                )}
              </IonCol>
            </IonRow>
          </IonGrid>
        </div>

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMessage}
          duration={3000}
          color={toastColor}
          position="bottom"
        />
      </IonContent>
    </IonPage>
  );
}