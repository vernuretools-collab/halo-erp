import { getMessaging, getToken, onMessage } from 'firebase/messaging'
import app, { db } from './firebaseService'
import { doc, updateDoc, arrayUnion } from 'firebase/firestore'

let messaging = null

try {
  messaging = getMessaging(app)
} catch (err) {
  console.warn('FCM Messaging is not supported in this browser environment:', err)
}

/**
 * Request notification permission and register FCM Web Push token
 */
export const requestFcmToken = async (userId) => {
  if (!messaging) return null

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.log('Notification permission denied by user.')
      return null
    }

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY
    const currentToken = await getToken(messaging, { vapidKey })

    if (currentToken && userId) {
      // Save FCM token to user document
      const userRef = doc(db, 'users', userId)
      await updateDoc(userRef, {
        fcmTokens: arrayUnion(currentToken),
      })
    }

    return currentToken
  } catch (err) {
    console.error('An error occurred while retrieving FCM token:', err)
    return null
  }
}

/**
 * Listen for foreground FCM messages when app is active
 */
export const onForegroundMessage = (callback) => {
  if (!messaging) return () => {}
  return onMessage(messaging, (payload) => {
    callback(payload)
  })
}
