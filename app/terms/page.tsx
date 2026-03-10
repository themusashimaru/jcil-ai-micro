import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-sm bg-background/80 border-b border-border/30">
        <div className="max-w-5xl mx-auto px-6 md:px-12 py-4">
          <nav className="flex items-center justify-between">
            <Link href="/" className="font-bebas text-2xl tracking-tight">
              <span className="text-accent">JCIL</span>
              <span className="text-muted-foreground">.AI</span>
            </Link>
            <Link href="/" className="font-mono text-xs text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest">
              &larr; Back to Home
            </Link>
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-6 md:px-12 py-16">
        <div className="mb-12">
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-accent">Legal</span>
          <h1 className="mt-4 font-bebas text-5xl md:text-7xl tracking-tight">TERMS OF SERVICE</h1>
        </div>

        <div className="space-y-12 font-mono text-sm text-muted-foreground leading-relaxed max-w-3xl">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-4">
              <span className="text-foreground/80">Effective Date:</span> March 9, 2026<br />
              <span className="text-foreground/80">Service:</span> JCIL.AI
            </p>
          </div>

          <section>
            <h2 className="font-bebas text-3xl tracking-tight text-foreground mb-4">1. ACCEPTANCE OF TERMS</h2>
            <p>
              By accessing or using JCIL.AI (&quot;the Service&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree to these Terms, you may not access or use the Service.
            </p>
          </section>

          <section>
            <h2 className="font-bebas text-3xl tracking-tight text-foreground mb-4">2. DESCRIPTION OF SERVICE</h2>
            <p>
              JCIL.AI is an AI-powered chat and development platform designed to provide information, tools, and guidance through a Christian conservative worldview. The Service utilizes Anthropic&apos;s Claude Sonnet 4.6 as its default large language model, with Anthropic&apos;s native web search for real-time information. Users may optionally bring their own API keys (BYOK) to use alternative providers including OpenAI, Google Gemini, xAI (Grok), and DeepSeek.
            </p>
          </section>

          <section>
            <h2 className="font-bebas text-3xl tracking-tight text-foreground mb-4">3. USER CONDUCT & ACCEPTABLE USE</h2>
            <p>
              To maintain the integrity and purpose of our community, strict adherence to our Code of Conduct is required.
            </p>

            <h3 className="font-bebas text-xl tracking-tight text-foreground mt-6 mb-3">A. Prohibited Content</h3>
            <p>You agree not to use the Service to generate, promote, or share content that includes:</p>
            <ul className="list-none mt-4 space-y-3 border-l border-border/30 pl-4">
              <li>
                <span className="text-foreground/80">Blasphemy & Profanity:</span> Strict zero-tolerance for vulgar language, profanity, or taking the names of God, Jesus Christ, or the Holy Spirit in vain.
              </li>
              <li>
                <span className="text-foreground/80">Obscenity:</span> Pornographic, sexually explicit, or violent content.
              </li>
              <li>
                <span className="text-foreground/80">Illegal Acts:</span> Content that promotes illegal activities or harm to self or others.
              </li>
            </ul>

            <h3 className="font-bebas text-xl tracking-tight text-foreground mt-6 mb-3">B. Prohibited Technical Actions</h3>
            <p>
              You agree not to attempt to manipulate the AI to bypass its safety filters or its designated Christian conservative persona. This includes:
            </p>
            <ul className="list-none mt-4 space-y-3 border-l border-border/30 pl-4">
              <li>
                <span className="text-foreground/80">Prompt Injection:</span> Using complex logic or roleplay to force the AI to ignore its system instructions.
              </li>
              <li>
                <span className="text-foreground/80">Filter Evasion:</span> Attempting to generate content that violates our values by disguising the intent.
              </li>
              <li>
                <span className="text-foreground/80">Reverse Engineering:</span> Attempting to discover the source code, system prompts, or underlying architecture of JCIL.AI.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-bebas text-3xl tracking-tight text-foreground mb-4">4. ENFORCEMENT & TERMINATION</h2>
            <p>JCIL.AI reserves the right to monitor user inputs using automated moderation systems.</p>
            <ul className="list-none mt-4 space-y-3 border-l border-border/30 pl-4">
              <li>
                <span className="text-foreground/80">Violation Consequences:</span> If you violate the prohibitions in Section 3, we reserve the right to immediately suspend or permanently terminate your access to the Service without prior notice.
              </li>
              <li>
                <span className="text-foreground/80">Refunds:</span> Users terminated for violating these Terms are not eligible for refunds on any paid subscriptions.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-bebas text-3xl tracking-tight text-foreground mb-4">5. DISCLAIMER OF WARRANTIES</h2>
            <ul className="list-none space-y-3 border-l border-border/30 pl-4">
              <li>
                <span className="text-foreground/80">Not Professional Advice:</span> JCIL.AI is an automated system. It is not a licensed counselor, theologian, medical doctor, or attorney. Responses should not be considered professional advice.
              </li>
              <li>
                <span className="text-foreground/80">No Endorsement:</span> While we strive for accuracy within our worldview, the AI may occasionally produce incorrect (&quot;hallucinated&quot;) or biased information. You use the information provided at your own risk.
              </li>
              <li>
                <span className="text-foreground/80">&quot;As Is&quot; Basis:</span> The Service is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-bebas text-3xl tracking-tight text-foreground mb-4">6. INTELLECTUAL PROPERTY</h2>
            <ul className="list-none space-y-3 border-l border-border/30 pl-4">
              <li>
                <span className="text-foreground/80">Your Content:</span> You retain ownership of the inputs you provide.
              </li>
              <li>
                <span className="text-foreground/80">Our Content:</span> The interface, branding, logos, and custom code of JCIL.AI are the property of JCIL.AI.
              </li>
              <li>
                <span className="text-foreground/80">AI License:</span> You are granted a limited, non-exclusive right to use the AI-generated outputs for your personal or internal business use, subject to the restrictions of our upstream providers (Anthropic).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-bebas text-3xl tracking-tight text-foreground mb-4">7. DATA HANDLING & PRIVACY</h2>
            <p>Your use of the Service is also governed by our Privacy Policy. You acknowledge that:</p>
            <ul className="list-none mt-4 space-y-3 border-l border-border/30 pl-4">
              <li>Chats are retained for 6 months for legal compliance and safety auditing.</li>
              <li>By default, chats are processed by Anthropic (Claude) as described in the Privacy Policy.</li>
              <li>If you enable BYOK (Bring Your Own Key) and select an alternative AI provider, your data is sent to that provider under their terms and privacy policy. JCIL.AI is not responsible for third-party provider data handling.</li>
              <li>API keys you provide are encrypted at rest using AES-256 encryption and are never shared with third parties other than the provider you selected.</li>
            </ul>
          </section>

          <section>
            <h2 className="font-bebas text-3xl tracking-tight text-foreground mb-4">8. LIMITATION OF LIABILITY</h2>
            <p>
              To the fullest extent permitted by law, JCIL.AI shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data, or goodwill, resulting from your use or inability to use the Service.
            </p>
          </section>

          <section>
            <h2 className="font-bebas text-3xl tracking-tight text-foreground mb-4">9. CHANGES TO TERMS</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will notify users of significant changes by posting the new Terms on this site. Your continued use of the Service constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="font-bebas text-3xl tracking-tight text-foreground mb-4">10. CONTACT INFORMATION</h2>
            <p>
              For questions regarding these Terms, please <Link href="/contact" className="text-accent hover:text-accent/80 transition-colors">contact us</Link>.
            </p>
          </section>
        </div>

        <div className="mt-16 pt-8 border-t border-border/30">
          <Link href="/" className="font-mono text-xs text-accent hover:text-accent/80 transition-colors uppercase tracking-widest">
            &larr; Back to Home
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/30 py-8">
        <div className="max-w-5xl mx-auto px-6 md:px-12 text-center">
          <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
            &copy; {new Date().getFullYear()} JCIL.AI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
