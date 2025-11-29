/**
 * ROOT LAYOUT
 *
 * PURPOSE:
 * - Root layout for the entire JCIL.AI application
 * - Provides global HTML structure, metadata, fonts, and theme configuration
 * - Wraps all pages with Supabase auth context and global providers
 *
 * PUBLIC ROUTES:
 * - Wraps all routes (/, /chat, /admin, /settings, /tools)
 *
 * SERVER ACTIONS:
 * - None (layout only)
 *
 * SECURITY/RLS NOTES:
 * - Must initialize Supabase client for auth state
 * - No sensitive data rendered at layout level
 *
 * RATE LIMITS:
 * - N/A (layout component)
 *
 * DEPENDENCIES/ENVS:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * TODO:
 * - [ ] Implement Supabase auth provider wrapper
 * - [ ] Add global error boundary
 * - [ ] Configure PWA metadata
 * - [ ] Add theme provider for black theme + glassmorphism
 * - [ ] Add global analytics/monitoring
 *
 * TEST PLAN:
 * - Verify auth state persists across page navigation
 * - Test SSR hydration
 * - Validate PWA manifest loads correctly
 * - Check theme variables are applied globally
 */

import type { Metadata } from 'next';
import './globals.css';
import { PWAInstaller } from '@/components/pwa/PWAInstaller';
import { OfflineIndicator } from '@/components/pwa/OfflineIndicator';
import { UserProfileProvider } from '@/contexts/UserProfileContext';
import { FaviconUpdater } from '@/components/admin/FaviconUpdater';

export const metadata: Metadata = {
  title: 'JCIL.AI | AI-Powered Tools for People of Faith',
  description: 'Intelligent AI assistance built on your values. Chat, research, Bible study, writing tools, and more. Safe for families. Enterprise-grade security.',
  manifest: '/api/manifest',
  themeColor: '#000000',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'JCIL.AI',
  },
  keywords: ['AI', 'Christian', 'faith', 'Bible study', 'AI chat', 'family safe AI', 'values-based AI'],
  authors: [{ name: 'JCIL.AI' }],
  creator: 'JCIL.AI',
  publisher: 'JCIL.AI',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://jcil.ai',
    siteName: 'JCIL.AI',
    title: 'JCIL.AI | AI-Powered Tools for People of Faith',
    description: 'Intelligent AI assistance built on your values. Chat, research, Bible study, writing tools, and more. Safe for families.',
    images: [
      {
        url: 'https://jcil.ai/api/og-image',
        width: 512,
        height: 512,
        alt: 'JCIL.AI - AI-Powered Tools for People of Faith',
      },
    ],
  },
  twitter: {
    card: 'summary',
    title: 'JCIL.AI | AI-Powered Tools for People of Faith',
    description: 'Intelligent AI assistance built on your values. Safe for families. Enterprise-grade security.',
    images: ['https://jcil.ai/api/og-image'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="bg-black text-white antialiased">
        <UserProfileProvider>
          <FaviconUpdater />
          <OfflineIndicator />
          {children}
          <PWAInstaller />
        </UserProfileProvider>
      </body>
    </html>
  );
}
