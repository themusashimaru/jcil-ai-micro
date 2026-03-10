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
import PowerFeatures from './components/landing/PowerFeatures';
import ToolsShowcase from './components/landing/ToolsShowcase';
import AcademicShowcase from './components/landing/AcademicShowcase';
import AgentsSection from './components/landing/AgentsSection';
import ComparisonSection from './components/landing/ComparisonSection';
import ValuesSection from './components/landing/ValuesSection';
import HowItWorks from './components/landing/HowItWorks';
import UseCases from './components/landing/UseCases';
import PricingSection from './components/PricingSection';
import FinalCTA from './components/landing/FinalCTA';
import IntegrationsShowcase from './components/landing/IntegrationsShowcase';

export default function HomePage() {
  return (
    <main id="main-content" className="min-h-screen bg-zinc-950 text-white">
      <LandingHeader transparent />

      <HeroSection />

      <TrustBar />

      <IntegrationsShowcase />

      <ProductsSection />

      <CapabilitiesHighlight />

      <PowerFeatures />

      <ToolsShowcase />

      <AcademicShowcase />

      <AgentsSection />

      <ComparisonSection />

      <ValuesSection />

      <HowItWorks />

      <UseCases />

      {/* Pricing */}
      <div id="pricing">
        <PricingSection />
      </div>

      <FinalCTA />

      <LandingFooter />
    </main>
  );
}
