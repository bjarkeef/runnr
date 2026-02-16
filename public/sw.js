// Auto-generated service worker - DO NOT EDIT MANUALLY
// Generated at: 2026-02-09T19:43:17.266Z
// Cache version: 1770666197266

const CACHE_VERSION = '1770666197266';
const CACHE_NAME = `runnr-${CACHE_VERSION}`;

// Static assets to cache for offline support
const STATIC_CACHE = `runnr-static-${CACHE_VERSION}`;
const urlsToCache = [
  '/',
  '/manifest.json'
];

// Install event - cache critical resources
self.addEventListener('install', (event) => {
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

// Fetch event - Network-first strategy for pages, cache-first for assets
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // NEVER cache API routes - always fetch fresh
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }
  
  // For pages: Network-first strategy (ensures users get latest updates)
  if (event.request.mode === 'navigate' || url.pathname.match(/^\/(runs|achievements|heatmap|route-planner|race-predictions|settings)\/?/)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Update cache with fresh response
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails (offline support)
          return caches.match(event.request);
        })
    );
    return;
  }
  
  // For static assets: Cache-first strategy
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        
        return fetch(event.request).then((response) => {
          // Cache valid responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
          
          return response;
        });
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  // Claim clients immediately
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE) {
              return caches.delete(cacheName);
            }
          })
        );
      })
    ])
  );
});
