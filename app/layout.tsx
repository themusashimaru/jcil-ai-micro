/**
 * ROOT LAYOUT
 *
 * PURPOSE:
 * - Root layout for the entire Delta-2 application
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

export const metadata: Metadata = {
  title: 'Delta-2 | AI Chat Interface',
  description: 'Production-ready AI chat interface with advanced tools',
  manifest: '/manifest.json',
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
    title: 'Delta-2',
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
          <OfflineIndicator />
          {children}
          <PWAInstaller />
        </UserProfileProvider>
      </body>
    </html>
  );
}
