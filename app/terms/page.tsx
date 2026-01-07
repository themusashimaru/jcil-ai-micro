/**
 * TERMS OF SERVICE PAGE
 */

import Link from 'next/link';

export default function TermsPage() {
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
        <h1 className="mb-8 text-4xl font-bold text-slate-900">Terms of Service</h1>

        <div className="space-y-8 text-slate-600">
          <div>
            <p className="text-sm text-slate-500 mb-4">
              <strong className="text-slate-700">Effective Date:</strong> November 12, 2025<br />
              <strong className="text-slate-700">Service:</strong> JCIL.AI
            </p>
          </div>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">1. Acceptance of Terms</h2>
            <p>
              By accessing or using JCIL.AI (&quot;the Service&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, you may not access or use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">2. Description of Service</h2>
            <p>
              JCIL.AI is an AI-powered chat assistant designed to provide information and guidance through a specific Christian conservative worldview. The Service utilizes third-party Large Language Models (Anthropic Claude) and web search (Perplexity) to generate responses.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">3. User Conduct & Acceptable Use</h2>
            <p>
              To maintain the integrity and purpose of our community, strict adherence to our Code of Conduct is required.
            </p>

            <h3 className="text-xl font-bold text-slate-900 mt-6 mb-3">A. Prohibited Content</h3>
            <p>You agree not to use the Service to generate, promote, or share content that includes:</p>
            <ul className="list-disc ml-6 mt-4 space-y-2">
              <li>
                <strong className="text-slate-700">Blasphemy & Profanity:</strong> Strict zero-tolerance for vulgar language, profanity, or taking the names of God, Jesus Christ, or the Holy Spirit in vain.
              </li>
              <li>
                <strong className="text-slate-700">Obscenity:</strong> Pornographic, sexually explicit, or violent content.
              </li>
              <li>
                <strong className="text-slate-700">Illegal Acts:</strong> Content that promotes illegal activities or harm to self or others.
              </li>
            </ul>

            <h3 className="text-xl font-bold text-slate-900 mt-6 mb-3">B. Prohibited Technical Actions (&quot;Jailbreaking&quot;)</h3>
            <p>
              You agree not to attempt to manipulate the AI to bypass its safety filters or its designated Christian conservative persona. This includes:
            </p>
            <ul className="list-disc ml-6 mt-4 space-y-2">
              <li>
                <strong className="text-slate-700">Prompt Injection:</strong> Using complex logic or roleplay to force the AI to ignore its system instructions.
              </li>
              <li>
                <strong className="text-slate-700">Filter Evasion:</strong> Attempting to generate content that violates our values by disguising the intent.
              </li>
              <li>
                <strong className="text-slate-700">Reverse Engineering:</strong> Attempting to discover the source code, system prompts, or underlying architecture of JCIL.AI.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">4. Enforcement & Termination</h2>
            <p>JCIL.AI reserves the right to monitor user inputs using automated moderation systems.</p>
            <ul className="list-disc ml-6 mt-4 space-y-2">
              <li>
                <strong className="text-slate-700">Violation Consequences:</strong> If you violate the prohibitions in Section 3, we reserve the right to immediately suspend or permanently terminate your access to the Service without prior notice.
              </li>
              <li>
                <strong className="text-slate-700">Refunds:</strong> Users terminated for violating these Terms are not eligible for refunds on any paid subscriptions.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">5. Disclaimer of Warranties (AI Limitations)</h2>
            <ul className="list-disc ml-6 space-y-2">
              <li>
                <strong className="text-slate-700">Not Professional Advice:</strong> JCIL.AI is an automated system. It is not a licensed counselor, theologian, medical doctor, or attorney. Responses should not be considered professional advice.
              </li>
              <li>
                <strong className="text-slate-700">No Endorsement:</strong> While we strive for accuracy within our worldview, the AI may occasionally produce incorrect (&quot;hallucinated&quot;) or biased information. You use the information provided at your own risk.
              </li>
              <li>
                <strong className="text-slate-700">&quot;As Is&quot; Basis:</strong> The Service is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">6. Intellectual Property</h2>
            <ul className="list-disc ml-6 space-y-2">
              <li>
                <strong className="text-slate-700">Your Content:</strong> You retain ownership of the inputs you provide.
              </li>
              <li>
                <strong className="text-slate-700">Our Content:</strong> The interface, branding, logos, and custom code of JCIL.AI are the property of JCIL.AI.
              </li>
              <li>
                <strong className="text-slate-700">AI License:</strong> You are granted a limited, non-exclusive right to use the AI-generated outputs for your personal or internal business use, subject to the restrictions of our upstream providers (Anthropic).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">7. Data Handling & Privacy</h2>
            <p>Your use of the Service is also governed by our Privacy Policy. You acknowledge that:</p>
            <ul className="list-disc ml-6 mt-4 space-y-2">
              <li>Chats are retained for 6 months for legal compliance and safety auditing.</li>
              <li>Chats are processed by third-party providers (Anthropic and Perplexity) as described in the Privacy Policy.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">8. Limitation of Liability</h2>
            <p>
              To the fullest extent permitted by law, JCIL.AI shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or goodwill, resulting from your use or inability to use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">9. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will notify users of significant changes by posting the new Terms on this site. Your continued use of the Service constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">10. Contact Information</h2>
            <p>
              For questions regarding these Terms, please <a href="/contact" className="text-blue-600 hover:underline">contact us</a>.
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
