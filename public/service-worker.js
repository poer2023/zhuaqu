/* Kill-switch Service Worker
 *
 * See `public/sw.js` for rationale. This duplicate filename covers common
 * registration defaults used by various PWA setups.
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

