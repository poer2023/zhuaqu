"use client"

import { useEffect } from "react"

export function ServiceWorkerCleaner() {
    useEffect(() => {
        if ("serviceWorker" in navigator) {
            const reloadKey = "zhaqu:sw-cleanup:reloaded"
            navigator.serviceWorker.getRegistrations().then(async (registrations) => {
                if (registrations.length === 0) return

                let didUnregister = false
                for (const registration of registrations) {
                    console.log("Unregistering stale service worker:", registration)
                    try {
                        didUnregister = (await registration.unregister()) || didUnregister
                    } catch (error) {
                        console.warn("Failed to unregister service worker:", error)
                    }
                }

                if ("caches" in window) {
                    try {
                        const keys = await caches.keys()
                        await Promise.all(keys.map((key) => caches.delete(key)))
                    } catch (error) {
                        console.warn("Failed to clear caches after SW cleanup:", error)
                    }
                }

                if (didUnregister && !sessionStorage.getItem(reloadKey)) {
                    sessionStorage.setItem(reloadKey, "1")
                    window.location.reload()
                }
            })
        }
    }, [])

    return null
}
