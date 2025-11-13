/**
 * COOKIE POLICY PAGE
 */

import Link from 'next/link';

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="container mx-auto px-4 py-6">
          <Link href="/" className="text-2xl font-bold">
            JCIL.AI
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="mb-8 text-4xl font-bold">Cookie Policy</h1>

        <div className="space-y-8 text-gray-300">
          <div>
            <p className="text-sm text-gray-400 mb-4">
              <strong>Effective Date:</strong> November 12, 2025<br />
              <strong>Service:</strong> JCIL.AI
            </p>
          </div>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. What Are Cookies?</h2>
            <p>
              Cookies are small text files that are placed on your device (computer, smartphone, or tablet) when you visit JCIL.AI. They allow our website to recognize your device, remember your preferences, and ensure the secure operation of our authentication systems.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. How We Use Cookies</h2>
            <p>
              We use cookies primarily to keep you logged in and to ensure our website runs securely and efficiently on the Vercel platform. We categorize our cookies as follows:
            </p>

            <h3 className="text-xl font-bold text-white mt-6 mb-3">A. Strictly Necessary Cookies (Essential)</h3>
            <p>
              These cookies are fundamental to the operation of JCIL.AI. You cannot switch these off in our systems, as the website cannot function without them.
            </p>
            <ul className="list-disc ml-6 mt-4 space-y-2">
              <li>
                <strong>Authentication (Auth0 & Supabase):</strong> We use cookies to identify you when you log in, manage your active session, and prevent you from having to re-enter your credentials on every page load.
              </li>
              <li>
                <strong>Security:</strong> These cookies help us detect malicious traffic and protect against Cross-Site Request Forgery (CSRF) attacks.
              </li>
            </ul>

            <h3 className="text-xl font-bold text-white mt-6 mb-3">B. Performance & Analytics Cookies</h3>
            <p>
              <strong>Vercel Analytics:</strong> Hosted on Vercel, we may use cookies to collect anonymous data on how our website performs (e.g., page load speeds, error rates). This helps us improve the user experience.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. Third-Party Cookies</h2>
            <p>
              Because we use trusted third-party infrastructure to build JCIL.AI, these providers may place cookies on your device:
            </p>
            <ul className="list-disc ml-6 mt-4 space-y-2">
              <li><strong>Auth0:</strong> Used for secure identity management and Single Sign-On (SSO).</li>
              <li><strong>Supabase:</strong> Used to maintain the connection between your browser and our database.</li>
              <li><strong>Vercel:</strong> Used for hosting metrics and edge network performance.</li>
            </ul>
            <p className="mt-4">
              <strong>Note:</strong> Our AI providers (xAI and OpenAI) process your text inputs on the server side and do not place cookies on your browser.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. Managing Your Cookie Preferences</h2>
            <p>
              Most web browsers automatically accept cookies, but you can usually modify your browser settings to decline cookies if you prefer.
            </p>
            <ul className="list-disc ml-6 mt-4 space-y-2">
              <li>
                <strong>Browser Controls:</strong> You can block or delete cookies through your browser settings (Chrome, Safari, Firefox, Edge).
              </li>
              <li>
                <strong>Consequence:</strong> Please be aware that if you block Strictly Necessary cookies (specifically those from Auth0 or Supabase), you will not be able to log in or use the chat features of JCIL.AI.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Changes to This Policy</h2>
            <p>
              We may update this Cookie Policy from time to time to reflect changes in our technology or legal requirements. The date at the top of this policy indicates when it was last updated.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. Contact Us</h2>
            <p>
              If you have questions about our use of cookies, please contact us at:<br />
              <strong>Email:</strong> <a href="mailto:info@jcil.ai" className="text-blue-400 hover:underline">info@jcil.ai</a>
            </p>
          </section>
        </div>

        {/* Back to home link */}
        <div className="mt-12 pt-8 border-t border-gray-800">
          <Link href="/" className="text-blue-400 hover:underline">
            ← Back to Home
          </Link>
        </div>
      </main>
    </div>
  );
}
