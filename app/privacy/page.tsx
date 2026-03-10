import Link from 'next/link';

export default function PrivacyPage() {
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
          <h1 className="mt-4 font-bebas text-5xl md:text-7xl tracking-tight">PRIVACY POLICY</h1>
        </div>

        <div className="space-y-12 font-mono text-sm text-muted-foreground leading-relaxed max-w-3xl">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-4">
              <span className="text-foreground/80">Effective Date:</span> March 9, 2026<br />
              <span className="text-foreground/80">Service:</span> JCIL.AI
            </p>
          </div>

          <section>
            <h2 className="font-bebas text-3xl tracking-tight text-foreground mb-4">1. INTRODUCTION</h2>
            <p>
              Welcome to JCIL.AI. We are committed to protecting your privacy while providing an AI-assisted chat experience aligned with Christian conservative values. This policy outlines how we collect, use, store, and delete your data.
            </p>
            <p className="mt-4">
              By using our service, you acknowledge that your data is processed in accordance with this policy and our Terms of Service.
            </p>
          </section>

          <section>
            <h2 className="font-bebas text-3xl tracking-tight text-foreground mb-4">2. INFORMATION WE COLLECT</h2>
            <p>We collect the following types of information to provide and secure our services:</p>
            <ul className="list-none mt-4 space-y-3 border-l border-border/30 pl-4">
              <li>
                <span className="text-foreground/80">Account Information:</span> We use NextAuth for secure authentication. We collect your email address and basic profile information necessary to create and manage your account.
              </li>
              <li>
                <span className="text-foreground/80">User Content:</span> This includes the text prompts you enter, the files you upload, and the AI-generated responses (collectively, &quot;Chat History&quot;).
              </li>
              <li>
                <span className="text-foreground/80">Technical Data:</span> We utilize Vercel for hosting and Supabase for database management. These services may collect metadata such as IP addresses, browser types, and interaction logs for security and performance monitoring.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-bebas text-3xl tracking-tight text-foreground mb-4">3. AI PROCESSING & THIRD-PARTY PROVIDERS</h2>
            <p>
              JCIL.AI utilizes specific third-party vendors to power our Artificial Intelligence capabilities. By using our service, you consent to your data being processed by these providers:
            </p>
            <ul className="list-none mt-4 space-y-3 border-l border-border/30 pl-4">
              <li>
                <span className="text-foreground/80">Default LLM Provider (Anthropic Claude):</span> Our default conversational intelligence is powered by Anthropic&apos;s Claude Sonnet 4.6. Your prompts are sent to Anthropic to generate responses. Anthropic does not use your data for model training.
              </li>
              <li>
                <span className="text-foreground/80">Web Search (Anthropic Native):</span> Real-time web searches are processed through Anthropic&apos;s native web search tool, integrated directly into the Claude model. Search queries are subject to Anthropic&apos;s privacy policy.
              </li>
              <li>
                <span className="text-foreground/80">Bring Your Own Key (BYOK):</span> JCIL supports optional BYOK for multiple AI providers including OpenAI, Google Gemini, xAI (Grok), and DeepSeek. When you provide your own API key and select an alternative provider, your prompts and data are sent directly to that provider under <span className="text-foreground/80">their</span> privacy policy and terms of service — not ours. We encrypt your API keys at rest using AES-256 encryption, but we are not responsible for how third-party providers handle your data.
              </li>
              <li>
                <span className="text-foreground/80">Image Generation (FLUX.2):</span> AI image generation is powered by Black Forest Labs&apos; FLUX.2 models via Replicate. Image prompts are sent to Replicate for processing.
              </li>
              <li>
                <span className="text-foreground/80">Code Execution (E2B):</span> Code Lab uses E2B sandboxed environments for secure code execution. Code you write and execute is processed in isolated E2B containers.
              </li>
              <li>
                <span className="text-foreground/80">App Integrations (Composio):</span> 67+ third-party app integrations are provided through Composio (SOC 2 compliant). When you connect an integration, data flows through Composio to the target application.
              </li>
              <li>
                <span className="text-foreground/80">Infrastructure:</span>
                <ul className="list-none mt-2 space-y-1 pl-4 border-l border-border/20">
                  <li>NextAuth: Identity management and login security.</li>
                  <li>Supabase: Encrypted database storage with row-level security for chat logs and user data.</li>
                  <li>Vercel: Cloud hosting and deployment.</li>
                  <li>Redis: Rate limiting and session management.</li>
                </ul>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-bebas text-3xl tracking-tight text-foreground mb-4">4. DATA RETENTION & DELETION</h2>
            <p>We enforce a strict data lifecycle to balance user privacy with legal compliance.</p>

            <h3 className="font-bebas text-xl tracking-tight text-foreground mt-6 mb-3">A. Automatic Retention Schedule</h3>
            <p>
              <span className="text-foreground/80">6-Month Hard Limit:</span> All chat logs, file uploads, and interaction history are permanently deleted from our servers and database (Supabase) 6 months after creation. Once deleted, this data is unrecoverable.
            </p>

            <h3 className="font-bebas text-xl tracking-tight text-foreground mt-6 mb-3">B. User-Initiated Deletion</h3>
            <p>
              Users have the option to delete chats from their interface at any time.
            </p>
            <p className="mt-4">
              If a user deletes a chat after 3 months, it is considered a &quot;Soft Delete.&quot; This removes the chat from the user&apos;s view immediately, but the data remains in our secure backend archives until the 6-month mandatory retention period expires, at which point it is permanently purged.
            </p>
          </section>

          <section>
            <h2 className="font-bebas text-3xl tracking-tight text-foreground mb-4">5. LAW ENFORCEMENT & LEGAL REQUESTS</h2>
            <p>JCIL.AI complies with valid legal processes.</p>
            <ul className="list-none mt-4 space-y-3 border-l border-border/30 pl-4">
              <li>
                <span className="text-foreground/80">Data Availability:</span> We can only produce records that currently exist within our 6-month retention window. We cannot recover data that has passed the 6-month hard deletion mark.
              </li>
              <li>
                <span className="text-foreground/80">Request Process:</span> Verified law enforcement agencies or users requesting their own data for legal purposes may submit requests through our <Link href="/contact" className="text-accent hover:text-accent/80 transition-colors">contact form</Link>.
              </li>
              <li>
                <span className="text-foreground/80">Preservation:</span> Upon receipt of a valid preservation order from law enforcement, we may pause the automatic deletion clock for specific records identified in the order.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-bebas text-3xl tracking-tight text-foreground mb-4">6. CONTENT FILTERING & VALUES</h2>
            <p>
              Our AI is tuned to provide responses through a Christian conservative lens. While we utilize Anthropic Claude for intelligence and Anthropic&apos;s native web search for real-time information, we apply our own system instructions to ensure content aligns with our community standards.
            </p>
          </section>

          <section>
            <h2 className="font-bebas text-3xl tracking-tight text-foreground mb-4">7. SECURITY</h2>
            <p>
              We implement industry-standard security measures. Your data is protected behind NextAuth authentication, and all data at rest in Supabase and in transit is encrypted. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="font-bebas text-3xl tracking-tight text-foreground mb-4">8. CONTACT US</h2>
            <p>
              If you have questions about this policy or need to submit a data request, please contact us at:
            </p>
            <p className="mt-4">
              <Link href="/contact" className="text-accent hover:text-accent/80 transition-colors">Contact Us &rarr;</Link>
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
