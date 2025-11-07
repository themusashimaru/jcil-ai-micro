'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// 🔥 FIXED: Check if prompt was recently dismissed (7 days cooldown)
const DISMISSAL_COOLDOWN = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

function wasRecentlyDismissed(): boolean {
  if (typeof window === 'undefined') return false;
  
  const dismissedAt = localStorage.getItem('installPromptDismissed');
  if (!dismissedAt) return false;
  
  const dismissedTime = parseInt(dismissedAt, 10);
  const now = Date.now();
  
  // If dismissed less than 7 days ago, don't show
  return (now - dismissedTime) < DISMISSAL_COOLDOWN;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // 🔥 FIXED: Check if user dismissed recently
    if (wasRecentlyDismissed()) {
      console.log('Install prompt recently dismissed, not showing');
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      console.log('Install prompt captured!');
      const installEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(installEvent);
      
      // Show prompt after 3 seconds
      setTimeout(() => { 
        setShowPrompt(true); 
      }, 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => { 
      window.removeEventListener('beforeinstallprompt', handler); 
    };
  }, []);

  const handleInstallClick = async () => {
    console.log('Install button clicked!', deferredPrompt);
    if (!deferredPrompt) {
      console.error('No deferred prompt available');
      return;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('User choice:', outcome);
      
      // 🔥 IMPROVED: Clear dismissal timestamp if user accepts
      if (outcome === 'accepted') {
        localStorage.removeItem('installPromptDismissed');
        console.log('App installed successfully!');
      }
      
      setDeferredPrompt(null);
      setShowPrompt(false);
    } catch (error) {
      console.error('Install error:', error);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('installPromptDismissed', Date.now().toString());
    console.log('Install prompt dismissed, will show again in 7 days');
  };

  // Don't render if shouldn't show
  if (!showPrompt || !deferredPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm animate-in slide-in-from-bottom-5 duration-500">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-5 backdrop-blur-sm">
        <div className="flex items-start gap-4">
          {/* Logo */}
          <div className="flex-shrink-0">
            <img
              src="/jcil-ai-logo.png"
              alt="Slingshot"
              className="w-14 h-14 rounded-xl object-contain shadow-md"
              onError={(e) => {
                // Fallback if logo doesn't load
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
              }}
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 text-base mb-1">
              Add Slingshot to Home Screen
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              Install for quick access and a better experience!
            </p>

            {/* Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleInstallClick}
                className="flex-1 bg-gradient-to-r from-blue-900 to-blue-800 hover:from-blue-950 hover:to-blue-900 text-white text-sm h-10 rounded-xl shadow-lg hover:shadow-xl font-semibold transform hover:scale-105 transition-all"
              >
                <Download className="w-4 h-4 mr-2" />
                Install App
              </Button>
              <Button
                onClick={handleDismiss}
                variant="ghost"
                className="text-slate-600 hover:bg-slate-100 text-sm h-10 px-4 rounded-xl font-medium"
              >
                Later
              </Button>
            </div>
          </div>

          {/* Close Button */}
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-slate-400 hover:text-slate-600 transition-colors hover:bg-slate-100 rounded-lg p-1"
            aria-label="Dismiss install prompt"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}