/**
 * FAVICON UPDATER
 * Client component that dynamically updates the favicon based on admin settings
 */

'use client';

import { useEffect } from 'react';

export function FaviconUpdater() {
  useEffect(() => {
    const loadFavicon = () => {
      try {
        const savedSettings = localStorage.getItem('admin_design_settings');
        if (savedSettings) {
          const settings = JSON.parse(savedSettings);
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
    window.addEventListener('design-settings-updated', loadFavicon);
    return () => window.removeEventListener('design-settings-updated', loadFavicon);
  }, []);

  return null; // This component doesn't render anything
}

function updateFavicon(faviconUrl: string) {
  // Remove existing favicon links
  const existingLinks = document.querySelectorAll('link[rel*="icon"]');
  existingLinks.forEach((link) => link.remove());

  // Add new favicon link
  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/png';
  link.href = faviconUrl;
  document.head.appendChild(link);

  // Add apple-touch-icon for iOS
  const appleLink = document.createElement('link');
  appleLink.rel = 'apple-touch-icon';
  appleLink.href = faviconUrl;
  document.head.appendChild(appleLink);
}
