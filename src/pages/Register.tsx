import React, { useState } from 'react';
import {
  IonButton,
  IonContent,
  IonInput,
  IonInputPasswordToggle,
  IonPage,
  IonTitle,
  IonModal,
  IonText,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonToast,
  IonSpinner,
  IonGrid,
  IonRow,
  IonCol
} from '@ionic/react';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';

const Register: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
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

  const handleOpenVerificationModal = () => {
    if (!validateForm()) return;
    setShowVerificationModal(true);
  };

  const doRegister = async () => {
    setShowVerificationModal(false);
    setLoading(true);

    try {
      // ============================================
      // STEP 1: Create auth user
      // ============================================
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.full_name,
            role: 'environmental_inspector'
          }
        }
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          setToastMessage('This email is already registered. Please login.');
          setToastColor('warning');
          setShowToast(true);
          setLoading(false);
          return;
        }
        throw new Error('Account creation failed: ' + authError.message);
      }

      const user = authData.user ?? authData.session?.user;

      if (!user) {
        throw new Error('Failed to create user account');
      }

      // ============================================
      // STEP 2: Upsert profile (INSERT OR UPDATE)
      // ============================================
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: form.full_name,
          role: 'environmental_inspector'
        }, {
          onConflict: 'id'
        });

      if (profileError) {
        console.error('Profile error:', profileError);
        throw new Error('Profile creation failed: ' + profileError.message);
      }

      // ============================================
      // STEP 3: Upsert livestock_owner (INSERT OR UPDATE)
      // ============================================
      const { error: ownerError } = await supabase
        .from('livestock_owners')
        .upsert({
          owner_name: form.full_name,
          email: form.email,
          contact_number: form.phone || null,
          created_by: user.id
        }, {
          onConflict: 'email'
        });

      if (ownerError) {
        console.warn('livestock_owners update notice:', ownerError.message);
      }

      setShowSuccessModal(true);

    } catch (err) {
      console.error('Registration error:', err);
      if (err instanceof Error) {
        setToastMessage(err.message);
      } else {
        setToastMessage('An unknown error occurred. Please try again.');
      }
      setToastColor('danger');
      setShowToast(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <IonPage>
      <IonContent className="ion-padding">
        <IonGrid style={{ maxWidth: '500px', margin: '0 auto', marginTop: '40px' }}>
          <IonRow>
            <IonCol>
              <IonCard>
                <IonCardContent>
                  <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                    <IonTitle style={{ fontSize: '24px', fontWeight: 'bold' }}>
                      Create Account
                    </IonTitle>
                    <IonText color="medium">
                      <p>Register as Environmental Inspector</p>
                    </IonText>
                  </div>

                  <IonInput
                    label="Full Name"
                    labelPlacement="stacked"
                    fill="outline"
                    placeholder="Enter your full name"
                    value={form.full_name}
                    onIonChange={(e) => setForm({ ...form, full_name: e.detail.value! })}
                    style={{ marginBottom: '16px' }}
                  />

                  <IonInput
                    label="Email"
                    labelPlacement="stacked"
                    fill="outline"
                    type="email"
                    placeholder="youremail@example.com"
                    value={form.email}
                    onIonChange={(e) => setForm({ ...form, email: e.detail.value! })}
                    style={{ marginBottom: '16px' }}
                  />

                  <IonInput
                    label="Phone (Optional)"
                    labelPlacement="stacked"
                    fill="outline"
                    type="tel"
                    placeholder="Enter your phone number"
                    value={form.phone}
                    onIonChange={(e) => setForm({ ...form, phone: e.detail.value! })}
                    style={{ marginBottom: '16px' }}
                  />

                  <IonInput
                    label="Organization (Optional)"
                    labelPlacement="stacked"
                    fill="outline"
                    placeholder="Enter your organization name"
                    value={form.organization_name}
                    onIonChange={(e) => setForm({ ...form, organization_name: e.detail.value! })}
                    style={{ marginBottom: '16px' }}
                  />

                  <IonInput
                    label="Password"
                    labelPlacement="stacked"
                    fill="outline"
                    type="password"
                    placeholder="Enter password (min 6 chars)"
                    value={form.password}
                    onIonChange={(e) => setForm({ ...form, password: e.detail.value! })}
                    style={{ marginBottom: '16px' }}
                  >
                    <IonInputPasswordToggle slot="end" />
                  </IonInput>

                  <IonInput
                    label="Confirm Password"
                    labelPlacement="stacked"
                    fill="outline"
                    type="password"
                    placeholder="Confirm your password"
                    value={form.confirm_password}
                    onIonChange={(e) => setForm({ ...form, confirm_password: e.detail.value! })}
                    style={{ marginBottom: '16px' }}
                  >
                    <IonInputPasswordToggle slot="end" />
                  </IonInput>

                  <IonButton
                    expand="block"
                    onClick={handleOpenVerificationModal}
                    disabled={loading}
                    style={{ marginTop: '16px' }}
                  >
                    {loading ? (
                      <>
                        <IonSpinner name="crescent" />
                        &nbsp;Creating...
                      </>
                    ) : (
                      'Register'
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
                          Sign in
                        </span>
                      </p>
                    </IonText>
                  </div>
                </IonCardContent>
              </IonCard>
            </IonCol>
          </IonRow>
        </IonGrid>

        {/* VERIFICATION MODAL */}
        <IonModal isOpen={showVerificationModal} onDidDismiss={() => setShowVerificationModal(false)}>
          <IonContent className="ion-padding" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IonCard style={{ maxWidth: '500px', margin: 'auto' }}>
              <IonCardHeader>
                <IonCardTitle>Confirm Registration</IonCardTitle>
                <hr />
                <IonCardSubtitle>Full Name</IonCardSubtitle>
                <IonCardTitle>{form.full_name}</IonCardTitle>

                <IonCardSubtitle>Email</IonCardSubtitle>
                <IonCardTitle>{form.email}</IonCardTitle>

                {form.phone && (
                  <>
                    <IonCardSubtitle>Phone</IonCardSubtitle>
                    <IonCardTitle>{form.phone}</IonCardTitle>
                  </>
                )}

                {form.organization_name && (
                  <>
                    <IonCardSubtitle>Organization</IonCardSubtitle>
                    <IonCardTitle>{form.organization_name}</IonCardTitle>
                  </>
                )}
              </IonCardHeader>
              <IonCardContent>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                  <IonButton fill="clear" onClick={() => setShowVerificationModal(false)}>Cancel</IonButton>
                  <IonButton color="primary" onClick={doRegister} disabled={loading}>
                    {loading ? (
                      <>
                        <IonSpinner name="crescent" />
                        &nbsp;Creating...
                      </>
                    ) : (
                      'Confirm'
                    )}
                  </IonButton>
                </div>
              </IonCardContent>
            </IonCard>
          </IonContent>
        </IonModal>

        {/* SUCCESS MODAL */}
        <IonModal isOpen={showSuccessModal} onDidDismiss={() => setShowSuccessModal(false)}>
          <IonContent className="ion-padding" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh', textAlign: 'center' }}>
            <IonTitle style={{ fontSize: '28px', marginBottom: '16px' }}>Registration Successful 🎉</IonTitle>
            <IonText>
              <p style={{ fontSize: '18px' }}>Your account has been created successfully.</p>
              <p style={{ fontSize: '16px', color: 'gray' }}>Please check your email to verify your account.</p>
            </IonText>
            <IonButton 
              color="primary" 
              onClick={() => {
                setShowSuccessModal(false);
                navigate('/login');
              }}
              style={{ marginTop: '24px' }}
            >
              Go to Login
            </IonButton>
          </IonContent>
        </IonModal>

        {/* TOAST NOTIFICATION */}
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
};

export default Register;