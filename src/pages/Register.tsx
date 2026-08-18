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
      // STEP 3: Upsert site_owner (INSERT OR UPDATE)
      // ============================================
      const { error: ownerError } = await supabase
        .from('site_owners')
        .upsert({
          owner_name: form.full_name,
          email: form.email,
          contact_number: form.phone || null,
          created_by: user.id
        }, {
          onConflict: 'email'
        });

      if (ownerError) {
        console.warn('site_owners update notice:', ownerError.message);
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