/**
 * JCIL.AI HOMEPAGE
 *
 * Clean, professional landing page.
 * Inspired by Anthropic's approach: clear hierarchy, generous whitespace.
 * All metrics and claims are verified and accurate.
 */

import LandingHeader from './components/landing/LandingHeader';
import LandingFooter from './components/landing/LandingFooter';
import HeroSection from './components/landing/HeroSection';
import TrustBar from './components/landing/TrustBar';
import ProductsSection from './components/landing/ProductsSection';
import CapabilitiesHighlight from './components/landing/CapabilitiesHighlight';
import AgentsSection from './components/landing/AgentsSection';
import ComparisonSection from './components/landing/ComparisonSection';
import HowItWorks from './components/landing/HowItWorks';
import UseCases from './components/landing/UseCases';
import PricingSection from './components/PricingSection';
import FinalCTA from './components/landing/FinalCTA';

export default function HomePage() {
  return (
    <main id="main-content" className="min-h-screen bg-black text-white">
      <LandingHeader transparent />

      <HeroSection />

      <TrustBar />

      <ProductsSection />

      <CapabilitiesHighlight />

      <AgentsSection />

      <ComparisonSection />

      <HowItWorks />

      <UseCases />

      {/* Pricing */}
      <div id="pricing" className="bg-black">
        <PricingSection />
      </div>

      <FinalCTA />

      <LandingFooter />
    </main>
  );
}
