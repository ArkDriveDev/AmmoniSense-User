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