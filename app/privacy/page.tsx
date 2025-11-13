/**
 * PRIVACY POLICY PAGE
 */

import Link from 'next/link';

export default function PrivacyPage() {
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
        <h1 className="mb-8 text-4xl font-bold">Privacy Policy & Data Handling Statement</h1>

        <div className="space-y-8 text-gray-300">
          <div>
            <p className="text-sm text-gray-400 mb-4">
              <strong>Effective Date:</strong> November 12, 2025<br />
              <strong>Service:</strong> JCIL.AI
            </p>
          </div>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Introduction</h2>
            <p>
              Welcome to JCIL.AI. We are committed to protecting your privacy while providing an AI-assisted chat experience aligned with Christian conservative values. This policy outlines how we collect, use, store, and delete your data.
            </p>
            <p className="mt-4">
              By using our service, you acknowledge that your data is processed in accordance with this policy and our Terms of Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. Information We Collect</h2>
            <p>We collect the following types of information to provide and secure our services:</p>
            <ul className="list-disc ml-6 mt-4 space-y-2">
              <li>
                <strong>Account Information:</strong> We use Auth0 for secure authentication. We collect your email address and basic profile information necessary to create and manage your account.
              </li>
              <li>
                <strong>User Content:</strong> This includes the text prompts you enter, the files you upload, and the AI-generated responses (collectively, &quot;Chat History&quot;).
              </li>
              <li>
                <strong>Technical Data:</strong> We utilize Vercel for hosting and Supabase for database management. These services may collect metadata such as IP addresses, browser types, and interaction logs for security and performance monitoring.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. AI Processing & Third-Party Providers</h2>
            <p>
              JCIL.AI utilizes specific third-party vendors to power our Artificial Intelligence capabilities. By using our service, you consent to your data being processed by these providers:
            </p>
            <ul className="list-disc ml-6 mt-4 space-y-2">
              <li>
                <strong>LLM Provider (xAI):</strong> Our core conversational intelligence is powered by xAI. Your prompts are sent to xAI to generate responses.
              </li>
              <li>
                <strong>Content Moderation (OpenAI):</strong> To ensure a safe environment, user inputs and outputs are passed through OpenAI&apos;s moderation endpoints. This is strictly for safety analysis and policy enforcement, not for training purposes.
              </li>
              <li>
                <strong>Infrastructure:</strong>
                <ul className="list-disc ml-6 mt-2 space-y-1">
                  <li>Auth0: Identity management and login security.</li>
                  <li>Supabase: Encrypted database storage for chat logs and user data.</li>
                  <li>Vercel: Cloud hosting and deployment.</li>
                </ul>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. Data Retention & Deletion Policy</h2>
            <p>We enforce a strict data lifecycle to balance user privacy with legal compliance.</p>

            <h3 className="text-xl font-bold text-white mt-6 mb-3">A. Automatic Retention Schedule</h3>
            <p>
              <strong>6-Month Hard Limit:</strong> All chat logs, file uploads, and interaction history are permanently deleted from our servers and database (Supabase) 6 months after creation. Once deleted, this data is unrecoverable.
            </p>

            <h3 className="text-xl font-bold text-white mt-6 mb-3">B. User-Initiated Deletion (&quot;Soft Delete&quot;)</h3>
            <p>
              Users have the option to delete chats from their interface at any time.
            </p>
            <p className="mt-4">
              If a user deletes a chat after 3 months, it is considered a &quot;Soft Delete.&quot; This removes the chat from the user&apos;s view immediately, but the data remains in our secure backend archives until the 6-month mandatory retention period expires, at which point it is permanently purged.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Law Enforcement & Legal Requests</h2>
            <p>JCIL.AI complies with valid legal processes.</p>
            <ul className="list-disc ml-6 mt-4 space-y-2">
              <li>
                <strong>Data Availability:</strong> We can only produce records that currently exist within our 6-month retention window. We cannot recover data that has passed the 6-month hard deletion mark.
              </li>
              <li>
                <strong>Request Process:</strong> Verified law enforcement agencies or users requesting their own data for legal purposes may submit requests to info@jcil.ai.
              </li>
              <li>
                <strong>Preservation:</strong> Upon receipt of a valid preservation order from law enforcement, we may pause the automatic deletion clock for specific records identified in the order.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. Content Filtering & Values</h2>
            <p>
              Our AI is tuned to provide responses through a Christian conservative lens. While we utilize xAI for intelligence and OpenAI for safety moderation, we apply our own system instructions to ensure content aligns with our community standards.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. Security</h2>
            <p>
              We implement industry-standard security measures. Your data is protected behind Auth0 authentication, and all data at rest in Supabase and in transit is encrypted. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">8. Contact Us</h2>
            <p>
              If you have questions about this policy or need to submit a data request, please contact us at:
            </p>
            <p className="mt-4">
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
