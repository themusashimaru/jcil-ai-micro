/**
 * JCIL.AI HOMEPAGE
 *
 * Streamlined landing page with clear visual hierarchy.
 * 8 focused sections — no filler, no repetition.
 */

import LandingHeader from './components/landing/LandingHeader';
import LandingFooter from './components/landing/LandingFooter';
import HeroSection from './components/landing/HeroSection';
import TrustBar from './components/landing/TrustBar';
import ProductsSection from './components/landing/ProductsSection';
import FeaturesGrid from './components/landing/FeaturesGrid';
import ValuesSection from './components/landing/ValuesSection';
import HowItWorks from './components/landing/HowItWorks';
import PricingSection from './components/PricingSection';
import FinalCTA from './components/landing/FinalCTA';

export default function HomePage() {
  return (
    <main id="main-content" className="min-h-screen bg-zinc-950 text-white">
      <LandingHeader transparent />

      <HeroSection />

      <TrustBar />

      <ProductsSection />

      <FeaturesGrid />

      <ValuesSection />

      <HowItWorks />

      {/* Pricing */}
      <div id="pricing">
        <PricingSection />
      </div>

      <FinalCTA />

      <LandingFooter />
    </main>
  );
}
