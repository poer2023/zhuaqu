import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";

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
          <div className="flex flex-1 flex-col pl-64 transition-all duration-300">
            <Header />
            <main className="flex-1 overflow-y-auto p-8">
              <div className="mx-auto max-w-6xl animate-fade-in">
                {children}
              </div>
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
