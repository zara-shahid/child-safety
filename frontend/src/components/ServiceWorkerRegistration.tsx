'use client'

import { useEffect, useState } from 'react'
import { initializeNotifications, getNotificationPermission } from '@/lib/notifications'

/**
 * Service Worker Registration Component
 * 
 * Handles:
 * - Service worker registration on mount
 * - Update detection and prompts
 * - Offline status indication
 */
export function ServiceWorkerRegistration() {
  const [isOffline, setIsOffline] = useState(false)
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

  useEffect(() => {
    // Check initial online status
    setIsOffline(!navigator.onLine)

    // Listen for online/offline events
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Initialize notifications and service worker
    initializeNotifications().then((status) => {
      console.log('[App] Notification status:', status)
    })

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          setRegistration(reg)
          console.log('[App] Service worker registered')

          // Check for updates
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New content is available
                  setUpdateAvailable(true)
                }
              })
            }
          })
        })
        .catch((error) => {
          console.error('[App] Service worker registration failed:', error)
        })
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Handle update activation
  const handleUpdate = () => {
    if (registration?.waiting) {
      // Tell the waiting service worker to skip waiting
      registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      
      // Reload once the new service worker takes over
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload()
      })
    }
  }

  return (
    <>
      {/* Offline Indicator */}
      {isOffline && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-auto z-50 animate-slide-up">
          <div className="bg-amber-500 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
            </svg>
            <div className="flex-1">
              <p className="font-medium text-sm">You're offline</p>
              <p className="text-xs opacity-90">Some features may be limited</p>
            </div>
          </div>
        </div>
      )}

      {/* Update Available Indicator */}
      {updateAvailable && (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-auto z-50 animate-slide-up">
          <div className="bg-primary-500 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <div className="flex-1">
              <p className="font-medium text-sm">Update available</p>
              <p className="text-xs opacity-90">New version ready to install</p>
            </div>
            <button
              onClick={handleUpdate}
              className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors"
            >
              Update
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default ServiceWorkerRegistration
