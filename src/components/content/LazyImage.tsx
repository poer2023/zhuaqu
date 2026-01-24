"use client"

import { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"

interface LazyImageProps {
    src: string
    alt: string
    className?: string
    fallback?: React.ReactNode
    onError?: (e: React.SyntheticEvent<HTMLImageElement>) => void
    aspectRatio?: "square" | "video" | "auto"
}

export function LazyImage({
    src,
    alt,
    className,
    fallback,
    onError,
    aspectRatio = "auto",
}: LazyImageProps) {
    const [isLoaded, setIsLoaded] = useState(false)
    const [isInView, setIsInView] = useState(false)
    const [hasError, setHasError] = useState(false)
    const imgRef = useRef<HTMLDivElement>(null)

    // Intersection Observer for lazy loading
    useEffect(() => {
        const element = imgRef.current
        if (!element) return

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        setIsInView(true)
                        observer.unobserve(entry.target)
                    }
                })
            },
            {
                rootMargin: "100px", // Start loading 100px before entering viewport
                threshold: 0.01,
            }
        )

        observer.observe(element)

        return () => {
            observer.disconnect()
        }
    }, [])

    const handleLoad = () => {
        setIsLoaded(true)
    }

    const handleError = (e: React.SyntheticEvent<HTMLImageElement>) => {
        setHasError(true)
        onError?.(e)
    }

    const aspectClass = {
        square: "aspect-square",
        video: "aspect-video",
        auto: "",
    }[aspectRatio]

    return (
        <div
            ref={imgRef}
            className={cn(
                "relative overflow-hidden bg-muted/30",
                aspectClass,
                className
            )}
        >
            {/* Skeleton placeholder */}
            {!isLoaded && !hasError && (
                <div className="absolute inset-0 animate-pulse">
                    <div className="w-full h-full bg-gradient-to-r from-muted/50 via-muted/30 to-muted/50 bg-[length:200%_100%] animate-shimmer" />
                </div>
            )}

            {/* Error fallback */}
            {hasError && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted/20">
                    {fallback || (
                        <div className="text-muted-foreground text-xs">
                            Failed to load
                        </div>
                    )}
                </div>
            )}

            {/* Actual image - only load when in view */}
            {isInView && !hasError && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                    src={src}
                    alt={alt}
                    className={cn(
                        "w-full h-full object-cover transition-opacity duration-300",
                        isLoaded ? "opacity-100" : "opacity-0"
                    )}
                    onLoad={handleLoad}
                    onError={handleError}
                    referrerPolicy="no-referrer"
                    loading="lazy"
                />
            )}
        </div>
    )
}

// Shimmer animation keyframes (add to globals.css or tailwind config)
// @keyframes shimmer {
//   0% { background-position: 200% 0; }
//   100% { background-position: -200% 0; }
// }
