"use client"

import * as React from "react"
import * as ToastPrimitive from "@radix-ui/react-toast"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

// ==================== Toast Context ====================

type ToastType = "default" | "success" | "error" | "warning"

interface Toast {
  id: string
  title?: string
  description?: string
  type?: ToastType
  duration?: number
}

interface ToastContextValue {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, "id">) => void
  removeToast: (id: string) => void
}

const ToastContext = React.createContext<ToastContextValue | null>(null)

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error("useToast must be used within ToastProvider")
  }
  return context
}

// Convenience methods
export function toast(options: Omit<Toast, "id">) {
  // This will be set by the provider
  if (typeof window !== "undefined" && (window as unknown as { __addToast?: (t: Omit<Toast, "id">) => void }).__addToast) {
    (window as unknown as { __addToast: (t: Omit<Toast, "id">) => void }).__addToast(options)
  }
}

toast.success = (title: string, description?: string) =>
  toast({ title, description, type: "success" })

toast.error = (title: string, description?: string) =>
  toast({ title, description, type: "error" })

toast.warning = (title: string, description?: string) =>
  toast({ title, description, type: "warning" })

// ==================== Toast Provider ====================

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const addToast = React.useCallback((toast: Omit<Toast, "id">) => {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { ...toast, id }])
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Expose addToast globally for convenience
  React.useEffect(() => {
    (window as unknown as { __addToast: typeof addToast }).__addToast = addToast
  }, [addToast])

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {toasts.map((t) => (
          <ToastPrimitive.Root
            key={t.id}
            duration={t.duration || 5000}
            onOpenChange={(open) => {
              if (!open) removeToast(t.id)
            }}
            className={cn(
              "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-lg border p-4 shadow-lg transition-all",
              "data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none",
              "data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full",
              {
                "bg-background border-border": t.type === "default" || !t.type,
                "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800": t.type === "success",
                "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800": t.type === "error",
                "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800": t.type === "warning",
              }
            )}
          >
            <div className="grid gap-1">
              {t.title && (
                <ToastPrimitive.Title className={cn(
                  "text-sm font-semibold",
                  {
                    "text-foreground": t.type === "default" || !t.type,
                    "text-green-800 dark:text-green-200": t.type === "success",
                    "text-red-800 dark:text-red-200": t.type === "error",
                    "text-amber-800 dark:text-amber-200": t.type === "warning",
                  }
                )}>
                  {t.title}
                </ToastPrimitive.Title>
              )}
              {t.description && (
                <ToastPrimitive.Description className="text-sm text-muted-foreground">
                  {t.description}
                </ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close className="absolute right-2 top-2 rounded-md p-1 opacity-0 transition-opacity hover:bg-secondary focus:opacity-100 focus:outline-none group-hover:opacity-100">
              <X className="h-4 w-4" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed top-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:max-w-[420px]" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  )
}
