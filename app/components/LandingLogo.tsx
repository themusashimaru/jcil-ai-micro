/**
 * LANDING PAGE LOGO COMPONENT
 *
 * Displays the logo from design settings on the landing page.
 * Falls back to text "JCIL.AI" if no logo is configured.
 */

'use client';

import { useEffect, useState } from 'react';

export default function LandingLogo() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogo = async () => {
      try {
        const response = await fetch('/api/design-settings');
        if (response.ok) {
          const data = await response.json();
          if (data.light_mode_logo) {
            setLogoUrl(data.light_mode_logo);
          }
        }
      } catch {
        // Silently fall back to text logo
      } finally {
        setLoading(false);
      }
    };
    fetchLogo();
  }, []);

  if (loading) {
    return <span className="text-xl font-bold text-white tracking-tight">JCIL.AI</span>;
  }

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={logoUrl} alt="JCIL.AI" className="h-8 w-auto object-contain" />
    );
  }

  return <span className="text-xl font-bold text-white tracking-tight">JCIL.AI</span>;
}
