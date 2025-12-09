/**
 * LANDING PAGE LOGO COMPONENT
 *
 * PURPOSE:
 * - Displays the light mode logo from design settings on the landing page
 * - Falls back to text "JCIL.AI" if no logo is configured
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function LandingLogo() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const response = await fetch('/api/design-settings');
        if (response.ok) {
          const data = await response.json();
          // Use light mode logo for landing page
          if (data.light_mode_logo) {
            setLogoUrl(data.light_mode_logo);
          }
        }
      } catch (error) {
        console.error('Failed to fetch logo:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogo();
  }, []);

  return (
    <Link href="/" className="flex items-center">
      {loading ? (
        // Show text while loading to prevent layout shift
        <span className="text-2xl font-bold bg-gradient-to-r from-blue-900 to-blue-700 bg-clip-text text-transparent">
          JCIL.AI
        </span>
      ) : logoUrl ? (
        // Show uploaded logo (light mode logo from admin settings)
        <img
          src={logoUrl}
          alt="JCIL.AI"
          className="h-10 w-auto object-contain"
        />
      ) : (
        // Fallback to text logo (dark blue gradient for light background)
        <span className="text-2xl font-bold bg-gradient-to-r from-blue-900 to-blue-700 bg-clip-text text-transparent">
          JCIL.AI
        </span>
      )}
    </Link>
  );
}
