import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

export async function registerForPushNotificationsAsync() {
    if (Platform.OS === 'web') {
        console.log('Web platformunda push notification desteği sınırlıdır.');
        return;
    }

    let token;

    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    if (Device.isDevice) {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            alert('Bildirim izni alınamadı!');
            return;
        }

        try {
            const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;

            const tokenData = await Notifications.getExpoPushTokenAsync({
                projectId,
            });
            token = tokenData.data;
        } catch (e) {
            console.error('Push Token alma hatası:', e);
        }
    } else {
        console.log('Fiziksel cihaz gereklidir (Emülatörde çalışmayabilir).');
    }

    return token;
}

/**
 * @deprecated SEC-001 CRITICAL: This function is DISABLED for security reasons.
 * 
 * SECURITY ISSUE: Client-side push notifications allow ANY authenticated user
 * to send notifications to ANY token, enabling spam and phishing attacks.
 * 
 * MIGRATION: Push notifications MUST be sent from Cloud Functions triggered by Firestore writes:
 * - onCreate: talepler -> notify customer about new talep
 * - onUpdate: talepler (status change) -> notify relevant parties
 * 
 * See functions/src/index.ts for server-side implementation.
 */
export async function sendPushNotification(expoPushToken: string, title: string, body: string, data: any = {}) {
    // SEC-001 FIX: COMPLETELY DISABLED - Return immediately without sending
    console.error('SEC-001 BLOCKED: Client-side push notifications are disabled for security. Use Cloud Functions instead.');

    // Log attempt for security audit (will be stripped in production)
    if (__DEV__) {
        console.warn('Attempted push notification blocked:', { to: expoPushToken?.substring(0, 20) + '...', title });
    }

    return; // Do nothing - all push must go through Cloud Functions
}

// Flag for development mode detection
declare const __DEV__: boolean;

