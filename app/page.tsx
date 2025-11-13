/**
 * JCIL.AI LANDING PAGE
 *
 * PURPOSE:
 * - Public homepage for JCIL.AI
 * - Show product features, pricing, and sign up CTA
 * - Christian conservative AI chat assistant
 */

import Link from 'next/link';

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
      <section className="container mx-auto px-4 py-20" id="pricing">
        <h2 className="mb-4 text-center text-4xl font-bold">Simple, Transparent Pricing</h2>
        <p className="mb-12 text-center text-gray-300">
          Choose the plan that fits your needs
        </p>

        <div className="grid gap-8 md:grid-cols-4 max-w-7xl mx-auto">
          {/* Free Tier */}
          <div className="glass-morphism rounded-2xl p-8 border border-gray-700">
            <h3 className="mb-2 text-2xl font-bold">Free</h3>
            <p className="mb-4 text-gray-400">Get started with basic access</p>
            <div className="mb-6">
              <span className="text-5xl font-bold">$0</span>
              <span className="text-gray-400">/month</span>
            </div>
            <ul className="mb-8 space-y-3 text-sm">
              <li className="flex items-center">
                <span className="mr-2 text-green-400">✓</span>
                10 messages per day
              </li>
              <li className="flex items-center">
                <span className="mr-2 text-green-400">✓</span>
                Basic AI responses
              </li>
              <li className="flex items-center">
                <span className="mr-2 text-green-400">✓</span>
                6-month data retention
              </li>
            </ul>
            <Link
              href="/signup"
              className="block w-full rounded-lg bg-gray-700 py-3 text-center font-semibold hover:bg-gray-600 transition"
            >
              Start Free
            </Link>
          </div>

          {/* Basic Tier */}
          <div className="glass-morphism rounded-2xl p-8 border border-gray-700">
            <h3 className="mb-2 text-2xl font-bold">Basic</h3>
            <p className="mb-4 text-gray-400">For regular users</p>
            <div className="mb-6">
              <span className="text-5xl font-bold">$10</span>
              <span className="text-gray-400">/month</span>
            </div>
            <ul className="mb-8 space-y-3 text-sm">
              <li className="flex items-center">
                <span className="mr-2 text-green-400">✓</span>
                100 messages per day
              </li>
              <li className="flex items-center">
                <span className="mr-2 text-green-400">✓</span>
                Enhanced AI responses
              </li>
              <li className="flex items-center">
                <span className="mr-2 text-green-400">✓</span>
                Priority support
              </li>
            </ul>
            <Link
              href="/signup"
              className="block w-full rounded-lg bg-blue-600 py-3 text-center font-semibold hover:bg-blue-500 transition"
            >
              Get Started
            </Link>
          </div>

          {/* Pro Tier */}
          <div className="glass-morphism rounded-2xl p-8 border-2 border-blue-500 relative">
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-500 px-4 py-1 rounded-full text-sm font-semibold">
              POPULAR
            </div>
            <h3 className="mb-2 text-2xl font-bold">Pro</h3>
            <p className="mb-4 text-gray-400">For power users</p>
            <div className="mb-6">
              <span className="text-5xl font-bold">$20</span>
              <span className="text-gray-400">/month</span>
            </div>
            <ul className="mb-8 space-y-3 text-sm">
              <li className="flex items-center">
                <span className="mr-2 text-green-400">✓</span>
                200 messages per day
              </li>
              <li className="flex items-center">
                <span className="mr-2 text-green-400">✓</span>
                Premium AI responses
              </li>
              <li className="flex items-center">
                <span className="mr-2 text-green-400">✓</span>
                5 image generations/day
              </li>
              <li className="flex items-center">
                <span className="mr-2 text-green-400">✓</span>
                Priority support
              </li>
            </ul>
            <Link
              href="/signup"
              className="block w-full rounded-lg bg-blue-500 py-3 text-center font-semibold hover:bg-blue-400 transition"
            >
              Get Started
            </Link>
          </div>

          {/* Executive Tier */}
          <div className="glass-morphism rounded-2xl p-8 border border-gray-700">
            <h3 className="mb-2 text-2xl font-bold">Executive</h3>
            <p className="mb-4 text-gray-400">Unlimited access</p>
            <div className="mb-6">
              <span className="text-5xl font-bold">$150</span>
              <span className="text-gray-400">/month</span>
            </div>
            <ul className="mb-8 space-y-3 text-sm">
              <li className="flex items-center">
                <span className="mr-2 text-green-400">✓</span>
                1,000 messages per day
              </li>
              <li className="flex items-center">
                <span className="mr-2 text-green-400">✓</span>
                Premium AI responses
              </li>
              <li className="flex items-center">
                <span className="mr-2 text-green-400">✓</span>
                10 image generations/day
              </li>
              <li className="flex items-center">
                <span className="mr-2 text-green-400">✓</span>
                Dedicated support
              </li>
            </ul>
            <Link
              href="/signup"
              className="block w-full rounded-lg bg-gray-700 py-3 text-center font-semibold hover:bg-gray-600 transition"
            >
              Get Started
            </Link>
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
