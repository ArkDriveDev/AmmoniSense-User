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