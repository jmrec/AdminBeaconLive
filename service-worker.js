// Basic service worker - installs and activates

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  // Optional: Precaching assets can go here
  // event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache)));
  self.skipWaiting(); // Force activation
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  // Optional: Clean up old caches here
  event.waitUntil(self.clients.claim()); // Take control immediately
});

self.addEventListener('fetch', (event) => {
  // Basic pass-through fetch - network first
  // More complex caching strategies can be added later
  event.respondWith(fetch(event.request));
});