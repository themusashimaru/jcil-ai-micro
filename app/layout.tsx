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
 * - [x] Configure PWA metadata
 * - [x] Add theme provider for black theme + glassmorphism
 * - [x] Add global analytics/monitoring (Vercel Analytics + Speed Insights)
 *
 * TEST PLAN:
 * - Verify auth state persists across page navigation
 * - Test SSR hydration
 * - Validate PWA manifest loads correctly
 * - Check theme variables are applied globally
 */

import type { Metadata, Viewport } from 'next';
import './globals.css';
import { PWAInstaller } from '@/components/pwa/PWAInstaller';
import { OfflineIndicator } from '@/components/pwa/OfflineIndicator';
import { UserProfileProvider } from '@/contexts/UserProfileContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { FaviconUpdater } from '@/components/admin/FaviconUpdater';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { GlobalErrorHandler } from '@/components/GlobalErrorHandler';

// Viewport configuration (separate export per Next.js 14 spec)
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: '#000000',
};

export const metadata: Metadata = {
  title: 'JCIL.AI | AI-Powered Tools for People of Faith',
  description:
    'Intelligent AI assistance built on your values. Chat, research, Bible study, writing tools, and more. Safe for families. Enterprise-grade security.',
  manifest: '/api/manifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'JCIL.AI',
  },
  keywords: [
    'AI',
    'Christian',
    'faith',
    'Bible study',
    'AI chat',
    'family safe AI',
    'values-based AI',
  ],
  authors: [{ name: 'JCIL.AI' }],
  creator: 'JCIL.AI',
  publisher: 'JCIL.AI',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://jcil.ai',
    siteName: 'JCIL.AI',
    title: 'JCIL.AI | AI-Powered Tools for People of Faith',
    description:
      'Intelligent AI assistance built on your values. Chat, research, Bible study, writing tools, and more. Safe for families.',
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
    description:
      'Intelligent AI assistance built on your values. Safe for families. Enterprise-grade security.',
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
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta
          name="google-site-verification"
          content="suQkOhSeAz8m1aB0yup8Ct1P7fzTMCzKta8HnI_Ez3s"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'SoftwareApplication',
              name: 'JCIL.AI',
              url: 'https://jcil.ai',
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Web',
              description:
                'AI-powered tools for people of faith. Chat, research, Bible study, writing tools, code lab, and more.',
              offers: {
                '@type': 'Offer',
                price: '0',
                priceCurrency: 'USD',
                description: 'Free tier available',
              },
              creator: {
                '@type': 'Organization',
                name: 'JCIL.AI',
                url: 'https://jcil.ai',
              },
            }),
          }}
        />
      </head>
      <body
        className="antialiased"
        style={{ backgroundColor: 'var(--background)', color: 'var(--foreground)' }}
      >
        <ThemeProvider>
          <UserProfileProvider>
            <FaviconUpdater />
            <OfflineIndicator />
            {children}
            <PWAInstaller />
          </UserProfileProvider>
        </ThemeProvider>
        <GlobalErrorHandler />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
