/**
 * Push Notification Service for EPCID
 * 
 * Handles:
 * - Service worker registration
 * - Push subscription management
 * - Local notifications (medication reminders, etc.)
 * - Permission management
 */

// Check if notifications are supported
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator
}

// Check if push notifications are supported
export function isPushSupported(): boolean {
  return isNotificationSupported() && 'PushManager' in window
}

// Get current permission status
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported'
  return Notification.permission
}

// Request notification permission
export async function requestNotificationPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (!isNotificationSupported()) return 'unsupported'

  try {
    const permission = await Notification.requestPermission()
    return permission
  } catch (error) {
    console.error('Error requesting notification permission:', error)
    return 'denied'
  }
}

// Register service worker
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.log('Service Worker not supported')
    return null
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    })

    console.log('Service Worker registered:', registration.scope)

    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready

    return registration
  } catch (error) {
    console.error('Service Worker registration failed:', error)
    return null
  }
}

// Get or create push subscription
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    console.log('Push notifications not supported')
    return null
  }

  const permission = await requestNotificationPermission()
  if (permission !== 'granted') {
    console.log('Notification permission not granted')
    return null
  }

  const registration = await navigator.serviceWorker.ready

  try {
    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      // Create new subscription
      // In production, get the VAPID public key from your server
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

      if (!vapidPublicKey) {
        console.log('VAPID public key not configured')
        return null
      }

      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as any,
      })

      // Send subscription to server
      await sendSubscriptionToServer(subscription)
    }

    return subscription
  } catch (error) {
    console.error('Failed to subscribe to push:', error)
    return null
  }
}

// Unsubscribe from push
export async function unsubscribeFromPush(): Promise<boolean> {
  if (!isPushSupported()) return false

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.getSubscription()

  if (subscription) {
    try {
      await subscription.unsubscribe()
      // Notify server of unsubscription
      await removeSubscriptionFromServer(subscription)
      return true
    } catch (error) {
      console.error('Failed to unsubscribe:', error)
      return false
    }
  }

  return true
}

// Send subscription to server
async function sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
  // TODO: Implement server-side subscription storage
  console.log('Push subscription:', JSON.stringify(subscription))

  // In production:
  // await fetch('/api/notifications/subscribe', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(subscription),
  // })
}

// Remove subscription from server
async function removeSubscriptionFromServer(subscription: PushSubscription): Promise<void> {
  // TODO: Implement server-side subscription removal
  console.log('Removing subscription:', subscription.endpoint)
}

// Helper to convert VAPID key
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/')

  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }

  return outputArray
}

// ============== Local Notifications ==============

export interface LocalNotificationOptions {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  requireInteraction?: boolean
  silent?: boolean
  data?: Record<string, unknown>
  actions?: Array<{
    action: string
    title: string
    icon?: string
  }>
}

// Show a local notification
export async function showLocalNotification(options: LocalNotificationOptions): Promise<boolean> {
  if (!isNotificationSupported()) return false

  const permission = getNotificationPermission()
  if (permission !== 'granted') {
    console.log('Notification permission not granted')
    return false
  }

  try {
    const registration = await navigator.serviceWorker.ready

    await registration.showNotification(options.title, {
      body: options.body,
      icon: options.icon || '/icons/icon-192x192.png',
      badge: options.badge || '/icons/badge-72x72.png',
      tag: options.tag,
      requireInteraction: options.requireInteraction || false,
      silent: options.silent || false,
      data: options.data,
      // actions: options.actions, // Only works with service worker
    })

    return true
  } catch (error) {
    console.error('Failed to show notification:', error)
    return false
  }
}

// ============== Medication Reminder Notifications ==============

export interface MedicationReminder {
  id: string
  medicationName: string
  dosage: string
  scheduledTime: Date
  childName: string
}

// Schedule a medication reminder
export function scheduleMedicationReminder(reminder: MedicationReminder): number | null {
  const now = Date.now()
  const scheduledTime = reminder.scheduledTime.getTime()
  const delay = scheduledTime - now

  if (delay <= 0) {
    // Time has passed, show immediately
    showMedicationReminder(reminder)
    return null
  }

  // Schedule for future
  const timeoutId = window.setTimeout(() => {
    showMedicationReminder(reminder)
  }, delay)

  return timeoutId
}

// Show medication reminder notification
async function showMedicationReminder(reminder: MedicationReminder): Promise<void> {
  await showLocalNotification({
    title: `💊 Medication Due for ${reminder.childName}`,
    body: `Time to give ${reminder.dosage} of ${reminder.medicationName}`,
    tag: `med-reminder-${reminder.id}`,
    requireInteraction: true,
    data: {
      type: 'medication-reminder',
      medicationId: reminder.id,
      url: '/dashboard/medications',
    },
  })

  // Also play a sound if allowed
  playReminderSound()
}

// Cancel a scheduled reminder
export function cancelMedicationReminder(timeoutId: number): void {
  window.clearTimeout(timeoutId)
}

// Play reminder sound
function playReminderSound(): void {
  try {
    const audio = new Audio('/sounds/notification.mp3')
    audio.volume = 0.5
    audio.play().catch(() => {
      // Audio play failed (probably due to user interaction requirement)
    })
  } catch {
    // Audio not supported
  }
}

// ============== Vital Alert Notifications ==============

export interface VitalAlert {
  childName: string
  vitalType: 'temperature' | 'heart_rate' | 'oxygen' | 'respiratory_rate'
  value: number
  unit: string
  severity: 'warning' | 'critical'
}

// Show vital alert notification
export async function showVitalAlert(alert: VitalAlert): Promise<void> {
  const vitalLabels = {
    temperature: 'Temperature',
    heart_rate: 'Heart Rate',
    oxygen: 'Oxygen Level',
    respiratory_rate: 'Respiratory Rate',
  }

  const isCritical = alert.severity === 'critical'

  await showLocalNotification({
    title: isCritical
      ? `🚨 CRITICAL: ${alert.childName}`
      : `⚠️ Alert: ${alert.childName}`,
    body: `${vitalLabels[alert.vitalType]}: ${alert.value}${alert.unit} - ${isCritical ? 'Seek immediate medical attention!' : 'Please check on your child.'
      }`,
    tag: `vital-alert-${alert.vitalType}`,
    requireInteraction: true,
    data: {
      type: 'vital-alert',
      severity: alert.severity,
      url: '/dashboard',
    },
  })
}

// ============== Initialization ==============

// Initialize notification service
export async function initializeNotifications(): Promise<{
  serviceWorker: boolean
  notifications: boolean
  push: boolean
}> {
  const status = {
    serviceWorker: false,
    notifications: false,
    push: false,
  }

  // Register service worker
  const registration = await registerServiceWorker()
  status.serviceWorker = registration !== null

  // Check notification permission
  status.notifications = getNotificationPermission() === 'granted'

  // Check push subscription
  if (status.serviceWorker && isPushSupported()) {
    try {
      const pushRegistration = await navigator.serviceWorker.ready
      const subscription = await pushRegistration.pushManager.getSubscription()
      status.push = subscription !== null
    } catch {
      status.push = false
    }
  }

  return status
}

export default {
  isNotificationSupported,
  isPushSupported,
  getNotificationPermission,
  requestNotificationPermission,
  registerServiceWorker,
  subscribeToPush,
  unsubscribeFromPush,
  showLocalNotification,
  scheduleMedicationReminder,
  cancelMedicationReminder,
  showVitalAlert,
  initializeNotifications,
}
