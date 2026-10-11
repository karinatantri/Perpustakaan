// Cache version - UPDATE INI SETIAP KALI DEPLOY BARU
// Format: v[timestamp] atau v[version-number]
const CACHE_NAME = 'perpustakaan-cache-v6';
const STATIC_CACHE_NAME = 'perpustakaan-static-v6';

// Assets yang selalu di-cache (critical files)
const CRITICAL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest'
];

// Assets yang tidak perlu di-cache (API calls, dll)
const NO_CACHE_PATTERNS = [
  '/api/',
  '/auth/',
  '/login',
  '/logout'
];

// Install event - install service worker baru
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...', CACHE_NAME);
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching critical assets');
      return cache.addAll(CRITICAL_ASSETS.map(url => new Request(url, { cache: 'reload' })));
    }).then(() => {
      // Skip waiting untuk langsung activate service worker baru
      return self.skipWaiting();
    })
  );
});

// Activate event - cleanup cache lama
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...', CACHE_NAME);
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Hapus cache lama yang bukan versi saat ini
          if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Claim semua clients untuk langsung menggunakan service worker baru
      return self.clients.claim();
    })
  );
});

// Fetch event - handle requests dengan cache strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip API calls dan auth routes (jangan cache)
  if (NO_CACHE_PATTERNS.some(pattern => url.pathname.includes(pattern))) {
    // Network only untuk API calls
    event.respondWith(fetch(request));
    return;
  }
  
  // Skip cross-origin requests
  if (url.origin !== self.location.origin) {
    return;
  }
  
  // Cache strategy: Network First, fallback to Cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Clone response untuk cache
        const responseClone = response.clone();
        
        // Cache successful responses (200-299)
        if (response.status >= 200 && response.status < 300) {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // If no cache, return offline page or error
          if (request.destination === 'document') {
            return caches.match('/index.html');
          }
          
          // Return error for other resources
          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        });
      })
  );
});

// Message event - handle messages from client untuk update cache
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.delete(CACHE_NAME).then(() => {
      event.ports[0].postMessage({ success: true });
    });
  }
});


