// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import InstallPrompt from "@/components/InstallPrompt";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "JCIL.AI - Christian AI Assistant",
  description: "AI-powered chat assistant with biblical filtering and faith-based insights.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "JCIL.AI" },
  icons: {
    icon: [
      { url: "/favicon.png" }, // favicon
    ],
    apple: [
      { url: "/jcil-ai-logo.png" }, // homescreen icon for iOS
    ],
  },
  openGraph: {
    title: "JCIL.AI - Christian AI Assistant",
    description: "Empowering faith-driven conversations through AI — guided by biblical wisdom.",
    url: "https://jcil.ai",
    siteName: "JCIL.AI",
    images: [
      {
        url: "/og-image.png", // optional: 1200x630px image in /public/
        width: 1200,
        height: 630,
        alt: "JCIL.AI Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "JCIL.AI - Christian AI Assistant",
    description: "AI-powered chat assistant with biblical filtering and guidance.",
    images: ["/og-image.png"],
  },
  metadataBase: new URL("https://jcil.ai"),
};

export const viewport: Viewport = {
  themeColor: "#1e3a8a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="JCIL.AI" />
        <link rel="apple-touch-icon" href="/jcil-ai-logo.png" />
        <link rel="icon" href="/favicon.png" sizes="32x32" type="image/png" />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        <InstallPrompt />
        {/* service worker registration DISABLED for now to stop 405 on /api/chat */}
      </body>
    </html>
  );
}
