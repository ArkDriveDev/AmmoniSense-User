import {
  IonPage,
  IonContent,
  IonItem,
  IonIcon,
  IonInput,
  IonButton,
  IonTitle,
  IonText,
  IonToast,
  IonSpinner,
  IonGrid,
  IonRow,
  IonCol,
  IonCard,
  IonCardContent
} from '@ionic/react';

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../services/supabase';
import { mailOutline, lockClosedOutline, personOutline } from 'ionicons/icons';

export default function Register() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastColor, setToastColor] = useState('success');

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
    phone: '',
    organization_name: ''
  });

  const validateForm = () => {
    if (!form.full_name || form.full_name.length < 2) {
      setToastMessage('Please enter your full name');
      setToastColor('danger');
      setShowToast(true);
      return false;
    }

    if (!form.email || !form.email.includes('@')) {
      setToastMessage('Please enter a valid email address');
      setToastColor('danger');
      setShowToast(true);
      return false;
    }

    if (!form.password || form.password.length < 6) {
      setToastMessage('Password must be at least 6 characters');
      setToastColor('danger');
      setShowToast(true);
      return false;
    }

    if (form.password !== form.confirm_password) {
      setToastMessage('Passwords do not match');
      setToastColor('danger');
      setShowToast(true);
      return false;
    }

    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.full_name,
            role: 'client'
          }
        }
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          setToastMessage('This email is already registered. Please login.');
        } else {
          setToastMessage('Registration failed: ' + authError.message);
        }
        setToastColor('danger');
        setShowToast(true);
        setLoading(false);
        return;
      }

      const user = authData.user ?? authData.session?.user;

      if (!user) {
        setToastMessage('Failed to create user account');
        setToastColor('danger');
        setShowToast(true);
        setLoading(false);
        return;
      }

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: user.id,
          full_name: form.full_name,
          role: 'client'
        }]);

      if (profileError) {
        console.error('Profile error:', profileError);
      }

      // Create client record
      const { error: clientError } = await supabase
        .from('clients')
        .insert([{
          full_name: form.full_name,
          email: form.email,
          phone: form.phone || null,
          organization_name: form.organization_name || null,
          profile_id: user.id
        }]);

      if (clientError) {
        console.error('Client error:', clientError);
      }

      setToastMessage('Registration successful! Please check your email to verify.');
      setToastColor('success');
      setShowToast(true);

      setTimeout(() => {
        navigate('/login');
      }, 3000);

    } catch (err) {
      console.error('Unexpected error:', err);
      setToastMessage('An unexpected error occurred. Please try again.');
      setToastColor('danger');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonContent className="ion-padding" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        minHeight: '100vh'
      }}>
        <IonGrid style={{ maxWidth: '400px', width: '100%' }}>
          <IonRow>
            <IonCol>
              <IonCard>
                <IonCardContent>
                  <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <IonTitle style={{ fontSize: '24px', fontWeight: 'bold' }}>
                      Create Account
                    </IonTitle>
                    <IonText color="medium">
                      <p>Register to monitor your piggery</p>
                    </IonText>
                  </div>

                  <IonItem>
                    <IonIcon icon={personOutline} slot="start" />
                    <IonInput
                      placeholder="Full Name *"
                      value={form.full_name}
                      onIonChange={(e) => setForm({ ...form, full_name: e.detail.value! })}
                    />
                  </IonItem>

                  <IonItem>
                    <IonIcon icon={mailOutline} slot="start" />
                    <IonInput
                      type="email"
                      placeholder="Email Address *"
                      value={form.email}
                      onIonChange={(e) => setForm({ ...form, email: e.detail.value! })}
                    />
                  </IonItem>

                  <IonItem>
                    <IonIcon icon={lockClosedOutline} slot="start" />
                    <IonInput
                      type="password"
                      placeholder="Password (min 6 chars) *"
                      value={form.password}
                      onIonChange={(e) => setForm({ ...form, password: e.detail.value! })}
                    />
                  </IonItem>

                  <IonItem>
                    <IonIcon icon={lockClosedOutline} slot="start" />
                    <IonInput
                      type="password"
                      placeholder="Confirm Password *"
                      value={form.confirm_password}
                      onIonChange={(e) => setForm({ ...form, confirm_password: e.detail.value! })}
                    />
                  </IonItem>

                  <IonItem>
                    <IonInput
                      placeholder="Phone Number (optional)"
                      value={form.phone}
                      onIonChange={(e) => setForm({ ...form, phone: e.detail.value! })}
                    />
                  </IonItem>

                  <IonItem>
                    <IonInput
                      placeholder="Organization Name (optional)"
                      value={form.organization_name}
                      onIonChange={(e) => setForm({ ...form, organization_name: e.detail.value! })}
                    />
                  </IonItem>

                  <IonButton
                    expand="block"
                    onClick={handleRegister}
                    disabled={loading}
                    style={{ marginTop: '16px' }}
                  >
                    {loading ? (
                      <>
                        <IonSpinner name="crescent" />
                        &nbsp;Creating Account...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </IonButton>

                  <div style={{ textAlign: 'center', marginTop: '16px' }}>
                    <IonText color="medium">
                      <p>
                        Already have an account?{' '}
                        <span 
                          style={{ color: 'var(--ion-color-primary)', cursor: 'pointer' }}
                          onClick={() => navigate('/login')}
                        >
                          Login
                        </span>
                      </p>
                    </IonText>
                  </div>

                  <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '8px' }}>
                    <IonText color="medium" style={{ fontSize: '12px' }}>
                      <p style={{ margin: '4px 0' }}>
                        After registration, an admin will need to assign your account to a piggery.
                      </p>
                      <p style={{ margin: '4px 0' }}>
                        You'll receive access once approved.
                      </p>
                    </IonText>
                  </div>
                </IonCardContent>
              </IonCard>
            </IonCol>
          </IonRow>
        </IonGrid>

        <IonToast
          isOpen={showToast}
          onDidDismiss={() => setShowToast(false)}
          message={toastMessage}
          duration={5000}
          color={toastColor}
          position="bottom"
        />
      </IonContent>
    </IonPage>
  );
}