/* ============================================
   SERVICE WORKER - OFFLINE FUNCTIONALITY
   Dictionary App PWA Support
   ============================================ */

const CACHE_NAME = 'dictionary-app-v1';
const RUNTIME_CACHE = 'dictionary-runtime-v1';

// Assets to cache on installation
const STATIC_ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Outfit:wght@300;400;500;600;700;800&display=swap'
];

/* ============================================
   INSTALL EVENT
   Cache static assets
   ============================================ */
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching static assets');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => {
                console.log('Service Worker: Installation complete');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('Service Worker: Installation failed', error);
            })
    );
});

/* ============================================
   ACTIVATE EVENT
   Clean up old caches
   ============================================ */
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');

    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME && cacheName !== RUNTIME_CACHE) {
                            console.log('Service Worker: Deleting old cache', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('Service Worker: Activation complete');
                return self.clients.claim();
            })
    );
});

/* ============================================
   FETCH EVENT
   Network-first strategy for API calls
   Cache-first strategy for static assets
   ============================================ */
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // API requests - Network first, fallback to cache
    if (url.origin === 'https://api.dictionaryapi.dev') {
        event.respondWith(networkFirstStrategy(request));
        return;
    }

    // Static assets - Cache first, fallback to network
    event.respondWith(cacheFirstStrategy(request));
});

/* ============================================
   CACHING STRATEGIES
   ============================================ */

/**
 * Cache-first strategy
 * Try cache first, then network, then fallback
 * @param {Request} request - Fetch request
 * @returns {Promise<Response>} Response
 */
async function cacheFirstStrategy(request) {
    try {
        // Try to get from cache first
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // If not in cache, fetch from network
        const networkResponse = await fetch(request);

        // Cache the new response if it's valid
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;

    } catch (error) {
        console.error('Cache-first strategy failed:', error);

        // Return a fallback offline page if available
        return caches.match('./index.html');
    }
}

/**
 * Network-first strategy
 * Try network first, then cache, then fallback
 * @param {Request} request - Fetch request
 * @returns {Promise<Response>} Response
 */
async function networkFirstStrategy(request) {
    try {
        // Try network first
        const networkResponse = await fetch(request);

        // Cache successful API responses
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(RUNTIME_CACHE);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;

    } catch (error) {
        console.log('Network failed, trying cache:', error);

        // If network fails, try cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }

        // Return error response if both fail
        return new Response(
            JSON.stringify({
                error: 'Offline',
                message: 'You are currently offline. Please check your internet connection.'
            }),
            {
                status: 503,
                statusText: 'Service Unavailable',
                headers: new Headers({
                    'Content-Type': 'application/json'
                })
            }
        );
    }
}

/* ============================================
   MESSAGE EVENT
   Handle messages from client
   ============================================ */
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data && event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => caches.delete(cacheName))
                );
            })
        );
    }
});

/* ============================================
   BACKGROUND SYNC (Future Enhancement)
   ============================================ */
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-searches') {
        event.waitUntil(syncSearches());
    }
});

/**
 * Sync searches when back online
 * @returns {Promise<void>}
 */
async function syncSearches() {
    console.log('Service Worker: Syncing searches...');
    // Future implementation for background sync
}

/* ============================================
   PUSH NOTIFICATIONS (Future Enhancement)
   ============================================ */
self.addEventListener('push', (event) => {
    const options = {
        body: event.data ? event.data.text() : 'New dictionary update available!',
        icon: './icon-192.png',
        badge: './icon-72.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        }
    };

    event.waitUntil(
        self.registration.showNotification('Dictionary App', options)
    );
});

console.log('Service Worker: Loaded successfully');
