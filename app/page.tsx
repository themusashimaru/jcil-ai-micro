/**
 * JCIL.AI HOMEPAGE
 *
 * Faith-first enterprise AI platform
 * Built for Christian developers, pastors, and ministries
 *
 * All metrics and claims on this page are verified and accurate.
 */

import LandingHeader from './components/landing/LandingHeader';
import LandingFooter from './components/landing/LandingFooter';
import HeroSection from './components/landing/HeroSection';
import WhyJcilSection from './components/landing/WhyJcilSection';
import ProductsSection from './components/landing/ProductsSection';
import ComparisonSection from './components/landing/ComparisonSection';
import ToolsShowcase from './components/landing/ToolsShowcase';
import CapabilitiesSection from './components/landing/CapabilitiesSection';
import DocumentSection from './components/landing/DocumentSection';
import AgentsSection from './components/landing/AgentsSection';
import SecuritySection from './components/landing/SecuritySection';
import HowItWorks from './components/landing/HowItWorks';
import FinalCTA from './components/landing/FinalCTA';
import SocialProof from './components/landing/Testimonials';
import UseCases from './components/landing/UseCases';
import EmailCapture from './components/landing/EmailCapture';
import LogoCarousel from './components/landing/LogoCarousel';
import Section from './components/landing/Section';
import IntegrationsShowcase from './components/landing/IntegrationsShowcase';
import PricingSection from './components/PricingSection';

export default function HomePage() {
  return (
    <main id="main-content" className="min-h-screen bg-black text-white">
      <LandingHeader transparent />

      <HeroSection />

      {/* Tech Partners Carousel */}
      <Section background="muted" padding="md" className="border-y border-white/5">
        <LogoCarousel title="Powered by industry-leading technology" speed="normal" />
      </Section>

      <IntegrationsShowcase />

      <WhyJcilSection />

      <ProductsSection />

      <ComparisonSection />

      <ToolsShowcase />

      <UseCases />

      <CapabilitiesSection />

      <DocumentSection />

      <AgentsSection />

      <SocialProof />

      <HowItWorks />

      <SecuritySection />

      {/* Pricing */}
      <div id="pricing" className="bg-black">
        <PricingSection />
      </div>

      {/* Email Capture */}
      <Section padding="lg" background="muted" className="border-y border-white/5">
        <div className="max-w-2xl mx-auto">
          <EmailCapture
            title="Stay in the Word, stay in the loop"
            description="Get updates on new features, faith-based AI insights, and early access to upcoming tools."
            buttonText="Get Updates"
          />
        </div>
      </Section>

      <FinalCTA />

      <LandingFooter />
    </main>
  );
}
