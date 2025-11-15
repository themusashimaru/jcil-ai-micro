/**
 * JCIL.AI LANDING PAGE
 *
 * PURPOSE:
 * - Public homepage for JCIL.AI
 * - Show product features, pricing, and sign up CTA
 * - Christian conservative AI chat assistant
 */

import Link from 'next/link';
import PricingSection from './components/PricingSection';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-gray-900 to-black">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="text-2xl font-bold">JCIL.AI</div>
          <div className="space-x-4">
            <Link href="/login" className="hover:text-gray-300">
              Log In
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-white px-6 py-2 text-black font-semibold hover:bg-gray-200"
            >
              Sign Up
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h1 className="mb-6 text-6xl font-bold leading-tight">
          AI-Powered Chat
          <br />
          <span className="text-blue-400">Through a Christian Conservative Lens</span>
        </h1>
        <p className="mx-auto mb-12 max-w-2xl text-xl text-gray-300">
          Get intelligent answers, guidance, and support from an AI assistant designed to align
          with Christian conservative values and principles.
        </p>
        <Link
          href="/signup"
          className="inline-block rounded-lg bg-blue-500 px-10 py-4 text-xl font-semibold hover:bg-blue-600 transition"
        >
          Get Started Free
        </Link>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-20">
        <h2 className="mb-12 text-center text-4xl font-bold">Why Choose JCIL.AI</h2>
        <div className="grid gap-8 md:grid-cols-3">
          <div className="glass-morphism rounded-2xl p-8">
            <div className="mb-4 text-4xl">✝️</div>
            <h3 className="mb-3 text-2xl font-semibold">Faith-Based Guidance</h3>
            <p className="text-gray-300">
              Responses grounded in Christian values and biblical principles, providing guidance
              that aligns with your faith.
            </p>
          </div>

          <div className="glass-morphism rounded-2xl p-8">
            <div className="mb-4 text-4xl">🤖</div>
            <h3 className="mb-3 text-2xl font-semibold">Advanced AI Technology</h3>
            <p className="text-gray-300">
              Powered by cutting-edge language models (xAI) with moderation safeguards (OpenAI)
              to ensure quality interactions.
            </p>
          </div>

          <div className="glass-morphism rounded-2xl p-8">
            <div className="mb-4 text-4xl">🔒</div>
            <h3 className="mb-3 text-2xl font-semibold">Privacy & Security</h3>
            <p className="text-gray-300">
              Your conversations are encrypted and automatically deleted after 6 months. We take
              your privacy seriously.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <PricingSection />

      {/* xAI Partnership Section */}
      <section className="container mx-auto px-4 py-20">
        <div className="glass-morphism mx-auto max-w-4xl rounded-3xl p-12 border border-blue-500/20">
          <h2 className="mb-6 text-center text-3xl font-bold text-blue-400">
            A Thank You to xAI
          </h2>
          <div className="space-y-6 text-lg text-gray-300 leading-relaxed">
            <p>
              We are grateful to <strong className="text-white">xAI</strong> for providing the API access
              that powers the intelligence behind JCIL.AI. Their cutting-edge technology enables us to
              deliver thoughtful, nuanced responses that align with our values and mission.
            </p>
            <p>
              What sets xAI apart is their unwavering commitment to <strong className="text-white">freedom of
              speech</strong> and <strong className="text-white">freedom of religion</strong>. In an era where
              many technology companies silence certain viewpoints, xAI stands firm in defending the right to
              express diverse perspectives and uphold deeply-held beliefs.
            </p>
            <p>
              <strong className="text-white">Our commitment:</strong> As long as xAI continues to
              champion truth, protect religious freedom, and allow us to exercise our Christian values without
              censorship or compromise, we will proudly continue utilizing their API services to serve you.
            </p>
            <p className="text-center pt-4">
              <span className="text-blue-400 font-semibold">
                Thank you, xAI, for the opportunity to build with your technology and for standing for what&apos;s right.
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="glass-morphism mx-auto max-w-3xl rounded-3xl p-12">
          <h2 className="mb-6 text-4xl font-bold">Ready to Get Started?</h2>
          <p className="mb-8 text-xl text-gray-300">
            Join JCIL.AI today and experience AI conversation guided by Christian conservative values.
          </p>
          <Link
            href="/signup"
            className="inline-block rounded-lg bg-blue-500 px-10 py-4 text-xl font-semibold hover:bg-blue-600 transition"
          >
            Create Your Account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-12">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <h3 className="mb-4 text-xl font-bold">JCIL.AI</h3>
              <p className="text-sm text-gray-400">
                AI-powered chat through a Christian conservative lens.
              </p>
            </div>

            <div>
              <h4 className="mb-4 font-semibold">Product</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>
                  <Link href="#pricing" className="hover:text-white">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/chat" className="hover:text-white">
                    Chat
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 font-semibold">Company</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>
                  <Link href="/marine-corps" className="hover:text-white">
                    Ode to the Marine Corps
                  </Link>
                </li>
                <li>
                  <a href="mailto:info@jcil.ai" className="hover:text-white">
                    Contact
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 font-semibold">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>
                  <Link href="/privacy" className="hover:text-white">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-white">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/cookies" className="hover:text-white">
                    Cookie Policy
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 border-t border-gray-800 pt-8 text-center text-sm text-gray-500">
            <p>&copy; {new Date().getFullYear()} JCIL.AI. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}
