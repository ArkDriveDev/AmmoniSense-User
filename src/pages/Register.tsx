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