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
import offlineStorage from '../services/OfflineStorageService';
import { mailOutline, lockClosedOutline, leafOutline } from 'ionicons/icons';

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

      // Save persistent offline session
      if (data?.session) {
        offlineStorage.saveSession(data.session, {
          email: data.session.user?.email || email,
          id: data.session.user?.id,
        });
      }

      navigate('/dashboard');

    } catch (err) {
      console.error('Login error:', err);
      setToastMessage('An unexpected error occurred');
      setShowToast(true);
    } finally {
      setLoading(false);
    }