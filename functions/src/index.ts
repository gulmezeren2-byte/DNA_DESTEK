/**
 * SEC-001 FIX: Firebase Cloud Functions for DNA DESTEK
 * 
 * These functions handle push notifications server-side,
 * triggered by Firestore document changes.
 * 
 * Deployment: firebase deploy --only functions
 * Requires: Firebase Blaze plan (pay-as-you-go)
 */

import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';

admin.initializeApp();
const db = admin.firestore();

/**
 * Send Expo Push Notification
 * Uses Expo's push notification service
 */
async function sendPushNotification(expoPushToken: string, title: string, body: string, data: any = {}) {
    if (!expoPushToken || !expoPushToken.startsWith('ExponentPushToken')) {
        console.warn('Invalid push token:', expoPushToken);
        return;
    }

    const message = {
        to: expoPushToken,
        sound: 'default',
        title: title,
        body: body,
        data: data,
    };

    try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message),
        });

        if (!response.ok) {
            console.error('Push notification failed:', response.status);
        } else {
            console.log('Push notification sent to:', expoPushToken.substring(0, 20) + '...');
        }
    } catch (error) {
        console.error('Push notification error:', error);
    }
}

/**
 * Get user's push token from push_tokens collection
 */
async function getUserPushToken(userId: string): Promise<string | null> {
    try {
        const tokenDoc = await db.collection('push_tokens').doc(userId).get();
        if (tokenDoc.exists) {
            return tokenDoc.data()?.token || null;
        }
    } catch (error) {
        console.error('Error fetching push token:', error);
    }
    return null;
}

/**
 * Trigger: Talep Status Changed
 * Notifies the customer when their talep status changes
 */
export const onTalepStatusChange = functions.firestore
    .document('talepler/{talepId}')
    .onUpdate(async (change: functions.Change<functions.firestore.QueryDocumentSnapshot>, context: functions.EventContext) => {
        const before = change.before.data();
        const after = change.after.data();

        // Only trigger on status change
        if (before.durum === after.durum) {
            return null;
        }

        const talepId = context.params.talepId;
        console.log(`Talep ${talepId}: Status changed from ${before.durum} to ${after.durum}`);

        // Durum map for notification messages
        const durumLabels: Record<string, string> = {
            'yeni': 'Yeni',
            'islemde': 'İşlemde',
            'beklemede': 'Beklemede',
            'cozuldu': 'Çözüldü',
            'iptal': 'İptal Edildi'
        };

        // Notify customer
        const customerId = after.olusturanId || after.musteriId;
        if (customerId) {
            const token = await getUserPushToken(customerId);
            if (token) {
                const durumLabel = durumLabels[after.durum] || after.durum;
                const title = after.durum === 'cozuldu'
                    ? 'Talep Çözüldü ✅'
                    : 'Talep Durumu Güncellendi 🔔';
                const body = `Talebinizin durumu "${durumLabel}" olarak güncellendi.`;

                await sendPushNotification(token, title, body, { talepId });
            }
        }

        return null;
    });

/**
 * Trigger: Talep Assigned to Team
 * Notifies team members when a talep is assigned to their team
 */
export const onTalepAssigned = functions.firestore
    .document('talepler/{talepId}')
    .onUpdate(async (change: functions.Change<functions.firestore.QueryDocumentSnapshot>, context: functions.EventContext) => {
        const before = change.before.data();
        const after = change.after.data();

        // Only trigger when ekip is newly assigned or changed
        if (before.atananEkipId === after.atananEkipId) {
            return null;
        }

        // Skip if ekip was removed (not assigned)
        if (!after.atananEkipId) {
            return null;
        }

        const talepId = context.params.talepId;
        const ekipId = after.atananEkipId;
        console.log(`Talep ${talepId}: Assigned to team ${ekipId}`);

        // Get team info
        const ekipDoc = await db.collection('ekipler').doc(ekipId).get();
        if (!ekipDoc.exists) {
            console.warn('Team not found:', ekipId);
            return null;
        }

        const ekipData = ekipDoc.data();
        const teamMembers = ekipData?.uyeler || [];

        // Notify customer
        const customerId = after.olusturanId || after.musteriId;
        if (customerId) {
            const token = await getUserPushToken(customerId);
            if (token) {
                const ekipAdi = after.atananEkipAdi || ekipData?.ad || 'Ekip';
                await sendPushNotification(
                    token,
                    'Ekip Atandı 🛠️',
                    `Talebiniz için ${ekipAdi} atandı.`,
                    { talepId }
                );
            }
        }

        // Notify team members
        for (const memberId of teamMembers) {
            const token = await getUserPushToken(memberId);
            if (token) {
                await sendPushNotification(
                    token,
                    'Yeni Görev Atandı 📋',
                    `${after.projeAdi}: ${after.baslik}`,
                    { talepId }
                );
            }
        }

        return null;
    });

/**
 * Trigger: New Talep Created
 * Notifies admins when a new talep is created
 */
export const onTalepCreated = functions.firestore
    .document('talepler/{talepId}')
    .onCreate(async (snapshot: functions.firestore.QueryDocumentSnapshot, context: functions.EventContext) => {
        const data = snapshot.data();
        const talepId = context.params.talepId;

        console.log(`New talep created: ${talepId}`);

        // Get all admin users
        const adminsSnapshot = await db.collection('users')
            .where('rol', '==', 'yonetim')
            .where('aktif', '==', true)
            .get();

        // Notify each admin
        for (const adminDoc of adminsSnapshot.docs) {
            const adminId = adminDoc.id;
            const token = await getUserPushToken(adminId);
            if (token) {
                const oncelik = data.oncelik === 'acil' ? '🚨 ACİL: ' : '';
                await sendPushNotification(
                    token,
                    `${oncelik}Yeni Talep 📝`,
                    `${data.projeAdi}: ${data.baslik}`,
                    { talepId }
                );
            }
        }

        return null;
    });
