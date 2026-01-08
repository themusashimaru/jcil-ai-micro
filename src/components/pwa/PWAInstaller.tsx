/**
 * PWA INSTALLER COMPONENT
 *
 * PURPOSE:
 * - Registers service worker for offline support
 * - Shows Add to Home Screen (A2HS) prompt when installable
 * - Displays PWA update notifications
 * - Handles SW lifecycle events
 *
 * BEHAVIOR:
 * - Auto-registers SW on mount (client-side only)
 * - Shows A2HS banner on supported devices (iOS, Android)
 * - Prompts user for updates when new SW available
 * - Dismissible with localStorage persistence
 *
 * TODO:
 * - [ ] Add offline indicator when no network
 * - [ ] Track installation analytics
 * - [ ] Add custom install UI for iOS (manual instructions)
 *
 * TEST PLAN:
 * - Verify SW registers successfully in browser DevTools
 * - Test A2HS prompt appears on mobile devices
 * - Verify prompt can be dismissed and doesn't reappear
 * - Check update notification when SW updated
 */

'use client';

import { useEffect, useState } from 'react';
import { logger } from '@/lib/logger';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstaller() {
  const log = logger('PWAInstaller');
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [showUpdatePrompt, setShowUpdatePrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    // Check if already installed
    const isInStandaloneMode = window.matchMedia('(display-mode: standalone)').matches;
    setIsStandalone(isInStandaloneMode);

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    setIsIOS(iOS);

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          log.info('Service Worker registered', { scope: registration.scope });

          // Check if there's already a waiting worker
          if (registration.waiting) {
            setWaitingWorker(registration.waiting);
            setShowUpdatePrompt(true);
          }

          // Check for updates
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  // New service worker available and waiting
                  setWaitingWorker(newWorker);
                  setShowUpdatePrompt(true);
                }
              });
            }
          });

          // Check for updates every hour
          setInterval(() => {
            registration.update();
          }, 60 * 60 * 1000);
        })
        .catch((error) => {
          log.error('Service Worker registration failed', error instanceof Error ? error : { error });
        });

      // Listen for controller change (when new SW takes over)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        log.info('New service worker activated, reloading...');
        window.location.reload();
      });
    }

    // Listen for beforeinstallprompt event (A2HS)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const event = e as BeforeInstallPromptEvent;
      setDeferredPrompt(event);

      // Check if user has dismissed before
      const dismissed = localStorage.getItem('pwa-install-dismissed');
      if (!dismissed && !isInStandaloneMode) {
        setShowInstallPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    // Show native install prompt
    deferredPrompt.prompt();

    // Wait for user choice
    const { outcome } = await deferredPrompt.userChoice;
    log.info('User responded to install prompt', { outcome });

    // Clear deferred prompt
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  const handleDismissInstall = () => {
    setShowInstallPrompt(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  const handleUpdate = () => {
    if (waitingWorker) {
      // Tell the waiting worker to skip waiting and become active
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
      // The controllerchange listener will handle the reload
    }
  };

  const handleDismissUpdate = () => {
    setShowUpdatePrompt(false);
  };

  // iOS Install Instructions
  if (isIOS && !isStandalone && showInstallPrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-slide-up">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 text-2xl">📱</div>
            <div className="flex-1">
              <h3 className="font-semibold text-white mb-1">Install JCIL.ai</h3>
              <p className="text-sm text-white/70 mb-3">
                Add to your home screen for quick access:
              </p>
              <ol className="text-sm text-white/70 mb-3 list-decimal list-inside space-y-1">
                <li>Tap the share button <span className="inline-block">
                  <svg className="w-4 h-4 inline" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16 5l-1.42 1.42-1.59-1.59V16h-1.98V4.83L9.42 6.42 8 5l4-4 4 4zm4 5v11c0 1.1-.9 2-2 2H6c-1.11 0-2-.9-2-2V10c0-1.11.89-2 2-2h3v2H6v11h12V10h-3V8h3c1.1 0 2 .89 2 2z" />
                  </svg>
                </span></li>
                <li>Scroll down and tap &quot;Add to Home Screen&quot;</li>
                <li>Tap &quot;Add&quot; in the top right</li>
              </ol>
              <button
                onClick={handleDismissInstall}
                className="text-sm text-white/50 hover:text-white/70 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Android/Desktop Install Prompt
  if (showInstallPrompt && deferredPrompt && !isStandalone) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-slide-up">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-4 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 text-2xl">⚡</div>
            <div className="flex-1">
              <h3 className="font-semibold text-white mb-1">Install JCIL.ai</h3>
              <p className="text-sm text-white/70 mb-3">
                Install this app for quick access from your home screen
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleInstallClick}
                  className="px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-white/90 transition-colors"
                >
                  Install
                </button>
                <button
                  onClick={handleDismissInstall}
                  className="px-4 py-2 text-sm text-white/70 hover:text-white/90 transition-colors"
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Update Available Prompt
  if (showUpdatePrompt) {
    return (
      <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-slide-up">
        <div className="bg-blue-500/10 backdrop-blur-xl border border-blue-500/20 rounded-2xl p-4 shadow-2xl">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 text-2xl">🔄</div>
            <div className="flex-1">
              <h3 className="font-semibold text-white mb-1">Update Available</h3>
              <p className="text-sm text-white/70 mb-3">
                A new version of JCIL.ai is available
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleUpdate}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors"
                >
                  Update Now
                </button>
                <button
                  onClick={handleDismissUpdate}
                  className="px-4 py-2 text-sm text-white/70 hover:text-white/90 transition-colors"
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
