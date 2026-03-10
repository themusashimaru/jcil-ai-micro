/**
 * JCIL.AI HOMEPAGE
 *
 * Editorial / brutalist landing page design.
 * Built with GSAP scroll animations, Lenis smooth scroll, and split-flap text.
 * Ported from v0 design — all metrics and claims are verified and accurate.
 *
 * Fonts (Bebas Neue, IBM Plex Mono) loaded via Google Fonts CDN in globals.css
 * to avoid build-time network dependency on next/font/google.
 */

import { LandingV2 } from './components/landing-v2/LandingV2';

export default function HomePage() {
  return (
    <div
      id="main-content"
      className="min-h-screen bg-background text-foreground"
    >
      <div className="noise-overlay" aria-hidden="true" />
      <LandingV2 />
    </div>
  );
}
