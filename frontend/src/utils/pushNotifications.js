import { PushNotifications } from '@capacitor/push-notifications';
import api from '../api';

/**
 * Registers the device for push notifications and forwards the token to the backend.
 */
export const registerPushNotifications = async (onNotificationReceived) => {
  const isCapacitor = typeof window !== 'undefined' && !!window.Capacitor;
  if (!isCapacitor) {
    console.log('[Push] Push notifications not supported on web/browser');
    return;
  }

  try {
    // Create Android notification channel for heads-up (pop-up) notifications
    try {
      await PushNotifications.createChannel({
        id: 'perpustakaan-channel',
        name: 'Notifikasi Perpustakaan',
        description: 'Saluran untuk notifikasi perpustakaan',
        importance: 5, // IMPORTANCE_HIGH (5) for heads-up pop-up
        visibility: 1, // VISIBILITY_PUBLIC
        sound: 'default',
        vibration: true
      });
      console.log('[Push] Notification channel created: perpustakaan-channel');
    } catch (channelErr) {
      console.error('[Push] Failed to create notification channel:', channelErr);
    }

    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('[Push] Permission not granted');
      return;
    }

    // Register with FCM/APNS
    await PushNotifications.register();

    // Clean listeners to avoid duplicate trigger bounds
    await PushNotifications.removeAllListeners();

    // On registration success
    await PushNotifications.addListener('registration', async (token) => {
      console.log('[Push] Registration successful. Token:', token.value);
      try {
        await api.post('/users/register-fcm-token', { token: token.value });
        localStorage.setItem('fcm_token', token.value);
      } catch (err) {
        console.error('[Push] Failed to register FCM token with backend:', err.message);
      }
    });

    // On registration error
    await PushNotifications.addListener('registrationError', (error) => {
      console.error('[Push] Registration error:', error);
    });

    // Trigger when notification is received while the app is active
    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[Push] Received active notification:', notification);
      if (typeof onNotificationReceived === 'function') {
        onNotificationReceived(notification);
      }
    });

    // Trigger when notification action (click) is performed
    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      console.log('[Push] Notification action performed:', action);
    });

  } catch (error) {
    console.error('[Push] Failed to register push notifications:', error);
  }
};

/**
 * Deregisters the device FCM token on the backend during logout.
 */
export const deregisterPushNotifications = async () => {
  const isCapacitor = typeof window !== 'undefined' && !!window.Capacitor;
  if (!isCapacitor) return;

  const token = localStorage.getItem('fcm_token');
  if (token) {
    try {
      await api.post('/users/deregister-fcm-token', { token });
      localStorage.removeItem('fcm_token');
      console.log('[Push] Deregistered FCM token from backend successfully');
    } catch (err) {
      console.error('[Push] Failed to deregister FCM token from backend:', err.message);
    }
  }
};
