import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import type { PrecacheEntry } from 'workbox-precaching'
import { registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkOnly } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

// Manifiesto de precache inyectado por vite-plugin-pwa (injectManifest).
const manifest = (self as unknown as { __WB_MANIFEST: Array<PrecacheEntry | string> }).__WB_MANIFEST

cleanupOutdatedCaches()
precacheAndRoute(manifest)

// Imagenes de manga (miniaturas y paginas): CacheFirst acotado (ADR-002).
registerRoute(
  ({ url }) =>
    url.pathname.includes('/api/v1/manga/') &&
    (url.pathname.endsWith('/thumbnail') || url.pathname.includes('/page/')),
  new CacheFirst({
    cacheName: 'aniweb-images',
    plugins: [new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 14 })],
  }),
)

// API del servidor: nunca cachear (es la fuente de verdad).
registerRoute(({ url }) => url.pathname.startsWith('/api/'), new NetworkOnly())
