/**
 * FAVICON UPDATER
 * Client component that dynamically updates the favicon and app icons based on admin settings
 * Fetches from the design-settings API to ensure consistency
 */

'use client';

import { useEffect } from 'react';

export function FaviconUpdater() {
  useEffect(() => {
    const loadFavicon = async () => {
      try {
        // Fetch from API for accurate settings
        const response = await fetch('/api/design-settings');
        if (response.ok) {
          const settings = await response.json();
          if (settings.favicon) {
            updateFavicon(settings.favicon);
          }
        }
      } catch (error) {
        console.error('Failed to load favicon settings:', error);
      }
    };

    loadFavicon();

    // Listen for settings updates
    const handleUpdate = () => loadFavicon();
    window.addEventListener('design-settings-updated', handleUpdate);
    return () => window.removeEventListener('design-settings-updated', handleUpdate);
  }, []);

  return null; // This component doesn't render anything
}

function updateFavicon(faviconUrl: string) {
  // Remove existing favicon and apple-touch-icon links
  const existingLinks = document.querySelectorAll('link[rel*="icon"]');
  existingLinks.forEach((link) => link.remove());

  // Add new favicon link
  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/png';
  link.href = faviconUrl;
  document.head.appendChild(link);

  // Add apple-touch-icon for iOS home screen
  const appleLink = document.createElement('link');
  appleLink.rel = 'apple-touch-icon';
  appleLink.href = faviconUrl;
  document.head.appendChild(appleLink);

  // Add apple-touch-icon-precomposed for older iOS
  const applePrecomposed = document.createElement('link');
  applePrecomposed.rel = 'apple-touch-icon-precomposed';
  applePrecomposed.href = faviconUrl;
  document.head.appendChild(applePrecomposed);
}
