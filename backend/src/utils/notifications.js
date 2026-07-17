const { getFirestore } = require('../firebase');
const admin = require('firebase-admin');

const db = getFirestore();

/**
 * Sends a push notification to a single registration token.
 */
async function sendPushNotification(token, title, body, data = {}) {
  try {
    const message = {
      notification: {
        title,
        body
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'perpustakaan-channel',
          sound: 'default'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default'
          }
        }
      },
      data: {
        ...data
      },
      token
    };
    const response = await admin.messaging().send(message);
    console.log('✓ Push notification sent successfully to token:', token, response);
    return response;
  } catch (err) {
    console.error('❌ Failed to send push notification to token:', token, err.message);
  }
}

/**
 * Sends a push notification to all FCM tokens registered for a specific user ID.
 */
async function sendPushNotificationToUser(userId, title, body, data = {}) {
  try {
    const fcmSnap = await db.collection('fcm_tokens').where('userId', '==', userId).get();
    if (fcmSnap.empty) {
      console.log(`No registered FCM tokens found for userId: ${userId}`);
      return;
    }
    const promises = fcmSnap.docs.map(doc => {
      const { token } = doc.data();
      return sendPushNotification(token, title, body, data);
    });
    await Promise.all(promises);
  } catch (err) {
    console.error('Failed to send push notifications to userId:', userId, err);
  }
}

/**
 * Sends a push notification to the user associated with a given student ID.
 */
async function sendPushNotificationToStudent(studentId, title, body, data = {}) {
  try {
    const usersSnap = await db.collection('users').where('studentId', '==', studentId).limit(1).get();
    if (usersSnap.empty) {
      console.log(`No user associated with studentId: ${studentId}`);
      return;
    }
    const userId = usersSnap.docs[0].id;
    await sendPushNotificationToUser(userId, title, body, data);
  } catch (err) {
    console.error('Failed to send push notifications to studentId:', studentId, err);
  }
}

module.exports = {
  sendPushNotification,
  sendPushNotificationToUser,
  sendPushNotificationToStudent
};
