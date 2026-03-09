/**
 * PRIVACY POLICY PAGE
 */

import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-slate-200/50">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold bg-gradient-to-r from-blue-900 to-blue-700 bg-clip-text text-transparent">
              JCIL.AI
            </Link>
            <Link
              href="/"
              className="text-slate-600 hover:text-slate-900 font-medium transition"
            >
              ← Back to Home
            </Link>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="mb-8 text-4xl font-bold text-slate-900">Privacy Policy & Data Handling Statement</h1>

        <div className="space-y-8 text-slate-600">
          <div>
            <p className="text-sm text-slate-500 mb-4">
              <strong className="text-slate-700">Effective Date:</strong> March 9, 2026<br />
              <strong className="text-slate-700">Service:</strong> JCIL.AI
            </p>
          </div>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">1. Introduction</h2>
            <p>
              Welcome to JCIL.AI. We are committed to protecting your privacy while providing an AI-assisted chat experience aligned with Christian conservative values. This policy outlines how we collect, use, store, and delete your data.
            </p>
            <p className="mt-4">
              By using our service, you acknowledge that your data is processed in accordance with this policy and our Terms of Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">2. Information We Collect</h2>
            <p>We collect the following types of information to provide and secure our services:</p>
            <ul className="list-disc ml-6 mt-4 space-y-2">
              <li>
                <strong className="text-slate-700">Account Information:</strong> We use NextAuth for secure authentication. We collect your email address and basic profile information necessary to create and manage your account.
              </li>
              <li>
                <strong className="text-slate-700">User Content:</strong> This includes the text prompts you enter, the files you upload, and the AI-generated responses (collectively, &quot;Chat History&quot;).
              </li>
              <li>
                <strong className="text-slate-700">Technical Data:</strong> We utilize Vercel for hosting and Supabase for database management. These services may collect metadata such as IP addresses, browser types, and interaction logs for security and performance monitoring.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">3. AI Processing & Third-Party Providers</h2>
            <p>
              JCIL.AI utilizes specific third-party vendors to power our Artificial Intelligence capabilities. By using our service, you consent to your data being processed by these providers:
            </p>
            <ul className="list-disc ml-6 mt-4 space-y-2">
              <li>
                <strong className="text-slate-700">Default LLM Provider (Anthropic Claude):</strong> Our default conversational intelligence is powered by Anthropic&apos;s Claude Sonnet 4.6. Your prompts are sent to Anthropic to generate responses. Anthropic does not use your data for model training.
              </li>
              <li>
                <strong className="text-slate-700">Web Search (Anthropic Native):</strong> Real-time web searches are processed through Anthropic&apos;s native web search tool, integrated directly into the Claude model. Search queries are subject to Anthropic&apos;s privacy policy.
              </li>
              <li>
                <strong className="text-slate-700">Bring Your Own Key (BYOK):</strong> JCIL supports optional BYOK for multiple AI providers including OpenAI, Google Gemini, xAI (Grok), and DeepSeek. When you provide your own API key and select an alternative provider, your prompts and data are sent directly to that provider under <strong>their</strong> privacy policy and terms of service — not ours. We encrypt your API keys at rest using AES-256 encryption, but we are not responsible for how third-party providers handle your data. We encourage you to review each provider&apos;s privacy policy before enabling BYOK.
              </li>
              <li>
                <strong className="text-slate-700">Image Generation (FLUX.2):</strong> AI image generation is powered by Black Forest Labs&apos; FLUX.2 models via Replicate. Image prompts are sent to Replicate for processing.
              </li>
              <li>
                <strong className="text-slate-700">Code Execution (E2B):</strong> Code Lab uses E2B sandboxed environments for secure code execution. Code you write and execute is processed in isolated E2B containers.
              </li>
              <li>
                <strong className="text-slate-700">App Integrations (Composio):</strong> 67+ third-party app integrations are provided through Composio (SOC 2 compliant). When you connect an integration, data flows through Composio to the target application.
              </li>
              <li>
                <strong className="text-slate-700">Infrastructure:</strong>
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>NextAuth: Identity management and login security.</li>
                  <li>Supabase: Encrypted database storage with row-level security for chat logs and user data.</li>
                  <li>Vercel: Cloud hosting and deployment.</li>
                  <li>Redis: Rate limiting and session management.</li>
                </ul>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">4. Data Retention & Deletion Policy</h2>
            <p>We enforce a strict data lifecycle to balance user privacy with legal compliance.</p>

            <h3 className="text-xl font-bold text-slate-900 mt-6 mb-3">A. Automatic Retention Schedule</h3>
            <p>
              <strong className="text-slate-700">6-Month Hard Limit:</strong> All chat logs, file uploads, and interaction history are permanently deleted from our servers and database (Supabase) 6 months after creation. Once deleted, this data is unrecoverable.
            </p>

            <h3 className="text-xl font-bold text-slate-900 mt-6 mb-3">B. User-Initiated Deletion (&quot;Soft Delete&quot;)</h3>
            <p>
              Users have the option to delete chats from their interface at any time.
            </p>
            <p className="mt-4">
              If a user deletes a chat after 3 months, it is considered a &quot;Soft Delete.&quot; This removes the chat from the user&apos;s view immediately, but the data remains in our secure backend archives until the 6-month mandatory retention period expires, at which point it is permanently purged.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">5. Law Enforcement & Legal Requests</h2>
            <p>JCIL.AI complies with valid legal processes.</p>
            <ul className="list-disc ml-6 mt-4 space-y-2">
              <li>
                <strong className="text-slate-700">Data Availability:</strong> We can only produce records that currently exist within our 6-month retention window. We cannot recover data that has passed the 6-month hard deletion mark.
              </li>
              <li>
                <strong className="text-slate-700">Request Process:</strong> Verified law enforcement agencies or users requesting their own data for legal purposes may submit requests through our <a href="/contact" className="text-blue-600 hover:underline">contact form</a>.
              </li>
              <li>
                <strong className="text-slate-700">Preservation:</strong> Upon receipt of a valid preservation order from law enforcement, we may pause the automatic deletion clock for specific records identified in the order.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">6. Content Filtering & Values</h2>
            <p>
              Our AI is tuned to provide responses through a Christian conservative lens. While we utilize Anthropic Claude for intelligence and Anthropic&apos;s native web search for real-time information, we apply our own system instructions to ensure content aligns with our community standards.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">7. Security</h2>
            <p>
              We implement industry-standard security measures. Your data is protected behind NextAuth authentication, and all data at rest in Supabase and in transit is encrypted. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">8. Contact Us</h2>
            <p>
              If you have questions about this policy or need to submit a data request, please contact us at:
            </p>
            <p className="mt-4">
              <a href="/contact" className="text-blue-600 hover:underline font-medium">Contact Us →</a>
            </p>
          </section>
        </div>

        {/* Back to home link */}
        <div className="mt-12 pt-8 border-t border-slate-200">
          <Link href="/" className="text-blue-600 hover:underline font-medium">
            ← Back to Home
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-8 mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-slate-400">
          <p>&copy; {new Date().getFullYear()} JCIL.AI. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
