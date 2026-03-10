import Link from 'next/link';

export default function CookiesPage() {
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
          <h1 className="mt-4 font-bebas text-5xl md:text-7xl tracking-tight">COOKIE POLICY</h1>
        </div>

        <div className="space-y-12 font-mono text-sm text-muted-foreground leading-relaxed max-w-3xl">
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-4">
              <span className="text-foreground/80">Effective Date:</span> March 9, 2026<br />
              <span className="text-foreground/80">Service:</span> JCIL.AI
            </p>
          </div>

          <section>
            <h2 className="font-bebas text-3xl tracking-tight text-foreground mb-4">1. WHAT ARE COOKIES?</h2>
            <p>
              Cookies are small text files that are placed on your device (computer, smartphone, or tablet) when you visit JCIL.AI. They allow our website to recognize your device, remember your preferences, and ensure the secure operation of our authentication systems.
            </p>
          </section>

          <section>
            <h2 className="font-bebas text-3xl tracking-tight text-foreground mb-4">2. HOW WE USE COOKIES</h2>
            <p>
              We use cookies primarily to keep you logged in and to ensure our website runs securely and efficiently on the Vercel platform. We categorize our cookies as follows:
            </p>

            <h3 className="font-bebas text-xl tracking-tight text-foreground mt-6 mb-3">A. Strictly Necessary Cookies</h3>
            <p>
              These cookies are fundamental to the operation of JCIL.AI. You cannot switch these off in our systems, as the website cannot function without them.
            </p>
            <ul className="list-none mt-4 space-y-3 border-l border-border/30 pl-4">
              <li>
                <span className="text-foreground/80">Authentication (NextAuth & Supabase):</span> We use cookies to identify you when you log in, manage your active session, and prevent you from having to re-enter your credentials on every page load.
              </li>
              <li>
                <span className="text-foreground/80">Security:</span> These cookies help us detect malicious traffic and protect against Cross-Site Request Forgery (CSRF) attacks.
              </li>
            </ul>

            <h3 className="font-bebas text-xl tracking-tight text-foreground mt-6 mb-3">B. Performance & Analytics Cookies</h3>
            <p>
              <span className="text-foreground/80">Vercel Analytics:</span> Hosted on Vercel, we may use cookies to collect anonymous data on how our website performs (e.g., page load speeds, error rates). This helps us improve the user experience.
            </p>
          </section>

          <section>
            <h2 className="font-bebas text-3xl tracking-tight text-foreground mb-4">3. THIRD-PARTY COOKIES</h2>
            <p>
              Because we use trusted third-party infrastructure to build JCIL.AI, these providers may place cookies on your device:
            </p>
            <ul className="list-none mt-4 space-y-3 border-l border-border/30 pl-4">
              <li><span className="text-foreground/80">NextAuth:</span> Used for secure identity management and session handling.</li>
              <li><span className="text-foreground/80">Supabase:</span> Used to maintain the connection between your browser and our database.</li>
              <li><span className="text-foreground/80">Vercel:</span> Used for hosting metrics and edge network performance.</li>
            </ul>
            <p className="mt-4">
              <span className="text-foreground/80">Note:</span> Our AI providers (Anthropic Claude and any BYOK providers you configure) process your text inputs on the server side and do not place cookies on your browser.
            </p>
          </section>

          <section>
            <h2 className="font-bebas text-3xl tracking-tight text-foreground mb-4">4. MANAGING YOUR COOKIE PREFERENCES</h2>
            <p>
              Most web browsers automatically accept cookies, but you can usually modify your browser settings to decline cookies if you prefer.
            </p>
            <ul className="list-none mt-4 space-y-3 border-l border-border/30 pl-4">
              <li>
                <span className="text-foreground/80">Browser Controls:</span> You can block or delete cookies through your browser settings (Chrome, Safari, Firefox, Edge).
              </li>
              <li>
                <span className="text-foreground/80">Consequence:</span> Please be aware that if you block Strictly Necessary cookies (specifically those from NextAuth or Supabase), you will not be able to log in or use the chat features of JCIL.AI.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-bebas text-3xl tracking-tight text-foreground mb-4">5. CHANGES TO THIS POLICY</h2>
            <p>
              We may update this Cookie Policy from time to time to reflect changes in our technology or legal requirements. The date at the top of this policy indicates when it was last updated.
            </p>
          </section>

          <section>
            <h2 className="font-bebas text-3xl tracking-tight text-foreground mb-4">6. CONTACT US</h2>
            <p>
              If you have questions about our use of cookies, please <Link href="/contact" className="text-accent hover:text-accent/80 transition-colors">contact us</Link>.
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
