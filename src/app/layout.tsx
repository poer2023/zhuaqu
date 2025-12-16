import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import Script from "next/script";

export const metadata: Metadata = {
  title: "ZhaQu | 内容生产系统",
  description: "X 内容抓取、改写与发布平台",
};

import { ServiceWorkerCleaner } from "@/components/ServiceWorkerCleaner";

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
        <Script id="sw-cleanup" strategy="beforeInteractive">
          {`(function(){try{if(!('serviceWorker'in navigator))return;var k='zhaqu:sw-cleanup:boot';if(sessionStorage.getItem(k))return;Promise.all([navigator.serviceWorker.getRegistrations(),('caches'in window)?caches.keys():Promise.resolve([])]).then(function(r){var regs=r[0]||[];var keys=r[1]||[];if(!regs.length&&!keys.length)return;return Promise.all(regs.map(function(reg){try{return reg.unregister()}catch(e){return false}})).then(function(){return Promise.all(keys.map(function(key){try{return caches.delete(key)}catch(e){return false}}))}).then(function(){sessionStorage.setItem(k,'1');location.reload()})})}catch(e){}})();`}
        </Script>
        <ServiceWorkerCleaner />
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
