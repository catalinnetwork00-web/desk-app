// sw.js - registered for Add to Home Screen. Plan B: no web push (no endpoint to POST a subscription to). No caching of data.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
