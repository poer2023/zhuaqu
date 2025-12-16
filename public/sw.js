/* Kill-switch Service Worker
 *
 * If a stale SW (from an older build or another app) is controlling this origin,
 * it can cause unexpected caching/interception (e.g. downloads not honoring headers).
 *
 * Hosting this file at common SW URLs helps the browser update to this version
 * and then immediately unregister itself and clear caches.
 */

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys()
        await Promise.all(keys.map((key) => caches.delete(key)))
      } catch {}

      try {
        await self.registration.unregister()
      } catch {}

      try {
        const clients = await self.clients.matchAll({ type: "window" })
        await Promise.all(
          clients.map((client) => {
            try {
              return client.navigate(client.url)
            } catch {
              return undefined
            }
          })
        )
      } catch {}
    })()
  )
})

self.addEventListener("fetch", () => {})

