import { useState } from 'react';
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
import { mailOutline, lockClosedOutline } from 'ionicons/icons';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const login = async () => {
    if (!email || !password) {
      setToastMessage('Please enter email and password');
      setShowToast(true);
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setToastMessage('Login failed: ' + error.message);
        setShowToast(true);
        setLoading(false);
        return;
      }

      navigate('/dashboard');

    } catch (err) {
      console.error('Login error:', err);
      setToastMessage('An unexpected error occurred');
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
                      Ammonisense
                    </IonTitle>
                    <IonText color="medium">
                      <p>Environmental Monitoring System</p>
                    </IonText>
                  </div>

                  <IonItem>
                    <IonIcon icon={mailOutline} slot="start" />
                    <IonInput
                      type="email"
                      placeholder="Email"
                      value={email}
                      onIonChange={(e) => setEmail(e.detail.value!)}
                    />
                  </IonItem>

                  <IonItem>
                    <IonIcon icon={lockClosedOutline} slot="start" />
                    <IonInput
                      type="password"
                      placeholder="Password"
                      value={password}
                      onIonChange={(e) => setPassword(e.detail.value!)}
                    />
                  </IonItem>

                  <IonButton
                    expand="block"
                    onClick={login}
                    disabled={loading}
                    style={{ marginTop: '16px' }}
                  >
                    {loading ? (
                      <>
                        <IonSpinner name="crescent" />
                        &nbsp;Logging in...
                      </>
                    ) : (
                      'Login'
                    )}
                  </IonButton>

                  <div style={{ textAlign: 'center', marginTop: '16px' }}>
                    <IonText color="medium">
                      <p>
                        Don't have an account?{' '}
                        <span 
                          style={{ color: 'var(--ion-color-primary)', cursor: 'pointer' }}
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