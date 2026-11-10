import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';

let listenersRegistered = false;

let activeUserId: string | null = null;
let lastRegisteredUserId: string | null = null;
let currentDeviceToken: string | null = null;

/**
 * Save the current device's FCM token to Supabase.
 */
const saveDeviceToken = async (token: string) => {
  const userId = activeUserId;

  if (!userId || !token) {
    return;
  }

  currentDeviceToken = token;

  const { error } = await supabase
    .from('device_tokens')
    .upsert(
      {
        user_id: userId,
        token,
        platform: Capacitor.getPlatform(),
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,token',
      }
    );

  if (error) {
    console.error('Error saving FCM token:', error);
    return;
  }

  console.log('FCM token successfully saved.');
};

/**
 * Register notification listeners only once.
 */
const registerPushListeners = async () => {
  if (listenersRegistered) {
    return;
  }

  await PushNotifications.addListener(
    'registration',
    async (token) => {
      console.log('FCM registration successful.');

      await saveDeviceToken(token.value);
    }
  );

  await PushNotifications.addListener(
    'registrationError',
    (error) => {
      console.error('FCM registration error:', error);
    }
  );

  await PushNotifications.addListener(
    'pushNotificationReceived',
    (notification) => {
      console.log('Push notification received:', notification);

      // Foreground notification handling can be connected
      // to SabTa's existing in-app notification UI.
    }
  );

  await PushNotifications.addListener(
    'pushNotificationActionPerformed',
    (action) => {
      console.log('Notification tapped:', action);

      // Use action.notification.data to determine
      // which SabTa screen should open.
    }
  );

  listenersRegistered = true;
};

/**
 * Register the current logged-in user for push notifications.
 */
export const setupPushNotifications = async (
  userId: string
): Promise<void> => {
  if (!userId) {
    console.warn('Cannot register push notifications without a user ID.');
    return;
  }

  if (!Capacitor.isNativePlatform()) {
    console.log('Push notifications are skipped on web.');
    return;
  }

  activeUserId = userId;

  try {
    let permission = await PushNotifications.checkPermissions();

    if (permission.receive === 'prompt') {
      permission = await PushNotifications.requestPermissions();
    }

    if (permission.receive !== 'granted') {
      console.warn('Notification permission was not granted.');
      return;
    }

    await registerPushListeners();

    // Do not register repeatedly for the same user.
    if (lastRegisteredUserId === userId) {
      return;
    }

    lastRegisteredUserId = userId;

    await PushNotifications.register();
  } catch (error) {
    lastRegisteredUserId = null;
    console.error('Push notification setup failed:', error);
  }
};

/**
 * Remove this device's token when the current user logs out.
 *
 * IMPORTANT: Await this function before calling supabase.auth.signOut().
 */
export const clearPushNotificationUser = async (): Promise<void> => {
  const previousUserId = activeUserId;
  const previousToken = currentDeviceToken;

  // Stop future registration callbacks from using the old account.
  activeUserId = null;
  lastRegisteredUserId = null;
  currentDeviceToken = null;

  if (!previousUserId || !previousToken) {
    return;
  }

  const { error } = await supabase
    .from('device_tokens')
    .delete()
    .eq('user_id', previousUserId)
    .eq('token', previousToken);

  if (error) {
    console.error('Could not remove this device token:', error);
  } else {
    console.log('This device was unregistered from the previous account.');
  }
};