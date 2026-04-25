/**
 * EPCID Service Worker
 * 
 * Provides:
 * - Offline support with cache-first strategy for static assets
 * - Network-first strategy for API calls with offline fallback
 * - Background sync for pending vital logs
 * - Push notification support
 */

const CACHE_NAME = 'epcid-cache-v1'
const OFFLINE_URL = '/offline.html'

// Assets to cache immediately on install
const PRECACHE_ASSETS = [
  '/',
  '/dashboard',
  '/offline.html',
  '/manifest.json',
]

// API endpoints that should be cached for offline use
const CACHEABLE_API_PATTERNS = [
  /\/api\/v1\/children/,
  /\/api\/v1\/medications/,
  /\/api\/dosage\/calculate/, // Dosage calculator works offline with cached data
]

// API endpoints that require sync when back online
const SYNC_API_PATTERNS = [
  /\/api\/v1\/symptoms/,
  /\/api\/v1\/assessment/,
  /\/api\/chat/,
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...')
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching precache assets')
        return cache.addAll(PRECACHE_ASSETS)
      })
      .then(() => {
        console.log('[SW] Service worker installed')
        return self.skipWaiting()
      })
      .catch((error) => {
        console.error('[SW] Installation failed:', error)
      })
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...')
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name)
              return caches.delete(name)
            })
        )
      })
      .then(() => {
        console.log('[SW] Service worker activated')
        return self.clients.claim()
      })
  )
})

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  
  // Skip non-http(s) requests (chrome-extension://, etc.)
  if (!url.protocol.startsWith('http')) {
    return
  }
  
  // Skip non-GET requests for caching (but not for sync)
  if (request.method !== 'GET') {
    // Queue POST/PUT/DELETE requests for background sync if offline
    if (!navigator.onLine && shouldSync(url.pathname)) {
      event.respondWith(queueForSync(request))
      return
    }
    return
  }
  
  // API requests - network first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithCache(request))
    return
  }
  
  // Static assets - cache first with network fallback
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstWithNetwork(request))
    return
  }
  
  // Navigation requests - network first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstWithOffline(request))
    return
  }
  
  // Default - network first with catch
  event.respondWith(
    fetch(request).catch((err) => {
      console.warn('[SW] Default fetch failed:', request.url, err)
      return new Response('Network error', { status: 408 })
    })
  )
})

// Helper to check if a request is cacheable
function isCacheableRequest(request) {
  const url = new URL(request.url)
  return url.protocol === 'http:' || url.protocol === 'https:'
}

// Network first with cache fallback (for API)
async function networkFirstWithCache(request) {
  const url = new URL(request.url)
  
  // Skip non-http(s) requests
  if (!isCacheableRequest(request)) {
    return fetch(request).catch(() => new Response('Invalid request', { status: 400 }))
  }
  
  try {
    const response = await fetch(request)
    
    // Cache successful API responses for offline use
    if (response.ok && isCacheableApi(url.pathname)) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    
    return response
  } catch (error) {
    console.log('[SW] Network failed, checking cache:', request.url)
    
    // Try cache
    const cached = await caches.match(request)
    if (cached) {
      console.log('[SW] Returning cached response')
      return cached
    }
    
    // Return offline JSON response for API
    return new Response(
      JSON.stringify({
        error: 'OFFLINE',
        message: 'You appear to be offline. This data will sync when you reconnect.',
        cached: false,
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

// Cache first with network fallback (for static assets)
async function cacheFirstWithNetwork(request) {
  // Skip non-http(s) requests
  if (!isCacheableRequest(request)) {
    return fetch(request).catch(() => new Response('Invalid request', { status: 400 }))
  }
  
  const cached = await caches.match(request)
  if (cached) {
    // Refresh cache in background
    fetch(request).then((response) => {
      if (response.ok && isCacheableRequest(request)) {
        caches.open(CACHE_NAME).then((cache) => cache.put(request, response))
      }
    }).catch(() => {})
    
    return cached
  }
  
  try {
    const response = await fetch(request)
    
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    
    return response
  } catch (error) {
    console.log('[SW] Both cache and network failed:', request.url)
    throw error
  }
}

// Network first with offline page fallback (for navigation)
async function networkFirstWithOffline(request) {
  // Skip non-http(s) requests
  if (!isCacheableRequest(request)) {
    return fetch(request).catch(() => new Response('Invalid request', { status: 400 }))
  }
  
  try {
    const response = await fetch(request)
    
    // Cache successful page loads
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME)
      cache.put(request, response.clone())
    }
    
    return response
  } catch (error) {
    console.log('[SW] Navigation failed, checking cache:', request.url)
    
    // Try cached version of the page
    const cached = await caches.match(request)
    if (cached) {
      return cached
    }
    
    // Return offline page
    const offlinePage = await caches.match(OFFLINE_URL)
    if (offlinePage) {
      return offlinePage
    }
    
    // Last resort - return a simple offline message
    return new Response(
      `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>EPCID - Offline</title>
          <style>
            body { font-family: system-ui; text-align: center; padding: 50px; background: #f3f4f6; }
            h1 { color: #0891b2; }
            p { color: #6b7280; }
            button { background: #0891b2; color: white; border: none; padding: 12px 24px; border-radius: 8px; cursor: pointer; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h1>📱 You're Offline</h1>
          <p>Please check your internet connection.</p>
          <p>Your data has been saved locally and will sync when you're back online.</p>
          <button onclick="window.location.reload()">Try Again</button>
        </body>
      </html>`,
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      }
    )
  }
}

// Check if URL is a static asset
function isStaticAsset(pathname) {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2']
  return staticExtensions.some(ext => pathname.endsWith(ext)) || pathname.startsWith('/_next/static/')
}

// Check if API endpoint should be cached
function isCacheableApi(pathname) {
  return CACHEABLE_API_PATTERNS.some(pattern => pattern.test(pathname))
}

// Check if request should be queued for sync
function shouldSync(pathname) {
  return SYNC_API_PATTERNS.some(pattern => pattern.test(pathname))
}

// Queue request for background sync
async function queueForSync(request) {
  // Store the request in IndexedDB for later sync
  const db = await openSyncDB()
  const tx = db.transaction('pending-requests', 'readwrite')
  const store = tx.objectStore('pending-requests')
  
  const body = await request.clone().text()
  
  await store.add({
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
    body,
    timestamp: Date.now(),
  })
  
  // Register for background sync
  if ('sync' in self.registration) {
    await self.registration.sync.register('sync-pending-requests')
  }
  
  return new Response(
    JSON.stringify({
      queued: true,
      message: 'Your changes have been saved and will sync when you\'re back online.',
    }),
    {
      status: 202,
      headers: { 'Content-Type': 'application/json' }
    }
  )
}

// Open IndexedDB for sync storage
function openSyncDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('epcid-sync', 1)
    
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains('pending-requests')) {
        db.createObjectStore('pending-requests', { keyPath: 'id', autoIncrement: true })
      }
    }
  })
}

// Background sync event
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pending-requests') {
    event.waitUntil(syncPendingRequests())
  }
})

// Sync pending requests when back online
async function syncPendingRequests() {
  const db = await openSyncDB()
  const tx = db.transaction('pending-requests', 'readonly')
  const store = tx.objectStore('pending-requests')
  const requests = await store.getAll()
  
  for (const req of requests) {
    try {
      await fetch(req.url, {
        method: req.method,
        headers: req.headers,
        body: req.body,
      })
      
      // Remove from queue on success
      const deleteTx = db.transaction('pending-requests', 'readwrite')
      await deleteTx.objectStore('pending-requests').delete(req.id)
      
      console.log('[SW] Synced pending request:', req.url)
    } catch (error) {
      console.error('[SW] Failed to sync request:', req.url, error)
    }
  }
}

// Push notification event
self.addEventListener('push', (event) => {
  if (!event.data) return
  
  const data = event.data.json()
  
  const options = {
    body: data.body || 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: data.data || {},
    actions: data.actions || [],
    tag: data.tag || 'epcid-notification',
    requireInteraction: data.requireInteraction || false,
  }
  
  // Different styling for different notification types
  if (data.type === 'medication-reminder') {
    options.icon = '/icons/pill-icon.png'
    options.requireInteraction = true
    options.actions = [
      { action: 'given', title: '✓ Given' },
      { action: 'snooze', title: '⏰ Snooze 30m' },
    ]
  } else if (data.type === 'vital-alert') {
    options.icon = '/icons/alert-icon.png'
    options.requireInteraction = true
    options.vibrate = [200, 100, 200, 100, 200]
  } else if (data.type === 'emergency') {
    options.icon = '/icons/emergency-icon.png'
    options.requireInteraction = true
    options.vibrate = [500, 100, 500, 100, 500]
    options.actions = [
      { action: 'call-911', title: '🚨 Call 911' },
      { action: 'view', title: 'View Details' },
    ]
  }
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'EPCID', options)
  )
})

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  
  const action = event.action
  const data = event.notification.data
  
  let url = '/dashboard'
  
  if (action === 'given') {
    url = `/dashboard/medications?log=${data.medicationId}`
  } else if (action === 'snooze') {
    // Schedule another notification in 30 minutes
    // This would typically be handled by the server
    url = '/dashboard/medications'
  } else if (action === 'call-911') {
    // Open phone dialer
    url = 'tel:911'
  } else if (action === 'view') {
    url = data.url || '/dashboard'
  } else if (data.url) {
    url = data.url
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      // Check if there's already a window open
      for (const client of windowClients) {
        if (client.url.includes('/dashboard') && 'focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      
      // Open a new window
      if (clients.openWindow) {
        return clients.openWindow(url)
      }
    })
  )
})

console.log('[SW] Service worker loaded')
