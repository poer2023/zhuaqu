import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";

export const metadata: Metadata = {
  title: "ZhaQu | 内容生产系统",
  description: "X 内容抓取、改写与发布平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full" suppressHydrationWarning>
      <body
        className="antialiased h-full bg-background text-foreground"
        suppressHydrationWarning
      >
        <div className="flex min-h-screen w-full">
          <Sidebar />
          {/* Main content uses CSS custom property for sidebar width, set by Sidebar component */}
          <main className="flex-1 ml-[var(--sidebar-width,240px)] transition-all duration-300 overflow-y-auto">
            <div className="p-6">
              {children}
            </div>
          </main>
        </div>
      </body>
    </html>
  );
}
