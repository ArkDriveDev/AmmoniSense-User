import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications';
import { supabase } from './supabase';

export const initializePushNotifications = async () => {
  if (!Capacitor.isNativePlatform()) {
    console.log('Push notifications are only available on native platforms (iOS/Android)');
    return;
  }

  try {
    let permStatus = await PushNotifications.requestPermissions();

    if (permStatus.receive === 'granted') {
      await PushNotifications.register();
      console.log('Push notifications registered');
    } else {
      console.log('Push notification permission denied');
      return;
    }
  } catch (err) {
    console.error('Error requesting permissions:', err);
    return;
  }

  PushNotifications.addListener('registration', (token: Token) => {
    console.log('Push registration success, token: ' + token.value);
    saveDeviceToken(token.value);
  });

  PushNotifications.addListener('registrationError', (err: any) => {
    console.error('Registration error: ' + err.error);
  });

  PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
    console.log('Push notification received: ', notification);
    showInAppNotification(notification);
  });

  PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
    console.log('Push notification action performed', notification);
  });
};

const saveDeviceToken = async (token: string) => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    if (!userId) {
      console.log('No user logged in, cannot save token');
      return;
    }

    const { data: existing } = await supabase
      .from('device_tokens')
      .select('id')
      .eq('token', token)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('device_tokens')
        .update({ last_used: new Date().toISOString() })
        .eq('id', existing.id);
      console.log('Device token updated');
    } else {
      await supabase
        .from('device_tokens')
        .insert({
          user_id: userId,
          token: token,
          platform: 'android',
          last_used: new Date().toISOString()
        });
      console.log('Device token saved');
    }
  } catch (err) {
    console.error('Error saving device token:', err);
  }
};

const showInAppNotification = (notification: PushNotificationSchema) => {
  console.log('In-app notification:', notification);
  const toast = document.createElement('ion-toast');
  toast.message = notification.title + ': ' + notification.body;
  toast.duration = 5000;
  toast.color = 'danger';
  toast.position = 'top';
  document.body.appendChild(toast);
  toast.present();
};

export const removeDeviceToken = async () => {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    if (!userId) return;

    await supabase
      .from('device_tokens')
      .delete()
      .eq('user_id', userId);
    
    console.log('Device token removed');
  } catch (err) {
    console.error('Error removing device token:', err);
  }
};